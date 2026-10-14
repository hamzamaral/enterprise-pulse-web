import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ClipboardList, Pencil, Power, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useProductionFindBom,
  useProductionPlanBom,
  useProductionRemoveBom,
  useProductionUpdateBom,
} from '@/api/generated/endpoints/production/production';
import type { BomDetailDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { useWarehouseOptions } from '@/features/inventory/inventory-components';
import { parseDecimal } from '@/features/trade/document-math';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { ActiveBadge, ToneBadge } from '@/shared/components/status-badge';
import { formatDateTime, formatMoney, formatQuantity } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import {
  AvailabilityBadge,
  useInvalidateProduction,
  WorkOrderDialog,
} from './production-components';

const ALL_WAREHOUSES = '__all__';

export function BomPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const invalidate = useInvalidateProduction();
  const [ordering, setOrdering] = useState(false);
  const { data: bom, isLoading } = useProductionFindBom(id);
  const update = useProductionUpdateBom();
  const remove = useProductionRemoveBom();

  if (!bom) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const canUpdate = can('production:update');
  const patch = (
    data: { isActive?: boolean; isDefault?: boolean },
    message:
      'production.bom.activated' | 'production.bom.deactivated' | 'production.bom.madeDefault',
  ) =>
    update.mutate(
      { id, data },
      {
        onSuccess: async () => {
          toast.success(t(message, { code: bom.code }));
          await invalidate();
        },
      },
    );
  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('production.bom.deleted', { code: bom.code }));
          await navigate({ to: '/production/boms' });
          await invalidate();
        },
      },
    );

  return (
    <>
      <Link
        to="/production/boms"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('production.bom.list')}
      </Link>
      <PageHeader
        title={`${bom.code} · ${bom.name}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {bom.productName}
              {bom.variantName && ` · ${bom.variantName}`}
            </span>
            {bom.isDefault && <ToneBadge tone="info">{t('production.bom.default')}</ToneBadge>}
            <ActiveBadge active={bom.isActive} />
          </span>
        }
        actions={
          canUpdate && (
            <>
              {bom.canDelete && (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" disabled={remove.isPending}>
                      <Trash2 /> {t('common.delete')}
                    </Button>
                  }
                  onConfirm={onDelete}
                />
              )}
              <Button
                variant="outline"
                disabled={update.isPending}
                onClick={() =>
                  patch(
                    { isActive: !bom.isActive },
                    bom.isActive ? 'production.bom.deactivated' : 'production.bom.activated',
                  )
                }
              >
                <Power />{' '}
                {bom.isActive ? t('production.bom.deactivate') : t('production.bom.activate')}
              </Button>
              {bom.isActive && !bom.isDefault && (
                <Button
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => patch({ isDefault: true }, 'production.bom.madeDefault')}
                >
                  <Star /> {t('production.bom.makeDefault')}
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/production/boms/edit/$id" params={{ id }}>
                  <Pencil /> {t('common.edit')}
                </Link>
              </Button>
              {bom.isActive && (
                <Button onClick={() => setOrdering(true)}>
                  <ClipboardList /> {t('production.workOrder.new')}
                </Button>
              )}
            </>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('production.bom.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('production.sku')}>
                <span className="font-mono text-xs">{bom.sku}</span>
              </Field>
              <Field label={t('production.bom.batch')}>
                {formatQuantity(bom.quantity, bom.unitCode)}
              </Field>
              <Field label={t('production.bom.workOrders')}>
                <span className="tabular-nums">{bom.workOrderCount}</span>
              </Field>
              <Field label={t('production.createdBy')}>{bom.createdByName}</Field>
              <Field label={t('production.updatedAt')}>{formatDateTime(bom.updatedAt)}</Field>
              <Field label={t('production.bom.buildable')}>
                {formatQuantity(bom.buildable, bom.unitCode)}
              </Field>
            </dl>
            {bom.notes && (
              <p className="text-muted-foreground mt-4 text-sm whitespace-pre-line">{bom.notes}</p>
            )}
          </CardContent>
        </Card>
        <CostCard bom={bom} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{t('production.bom.lines')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t('production.component')}</TableHead>
                <TableHead className="text-right">{t('production.quantity')}</TableHead>
                <TableHead className="text-right">{t('production.bom.scrap')}</TableHead>
                <TableHead className="text-right">{t('production.perUnit')}</TableHead>
                <TableHead className="text-right">{t('production.cost.unit')}</TableHead>
                <TableHead className="text-right">{t('production.cost.line')}</TableHead>
                <TableHead className="text-right">{t('production.onHand')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bom.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground">{line.lineNo}</TableCell>
                  <TableCell>
                    <code className="text-muted-foreground mr-2 text-xs">{line.sku}</code>
                    {line.productName}
                    {line.variantName && ` · ${line.variantName}`}
                    {line.madeBomId && (
                      <Link
                        to="/production/boms/$id"
                        params={{ id: line.madeBomId }}
                        className="ml-2"
                      >
                        <ToneBadge tone="info">{t('production.made')}</ToneBadge>
                      </Link>
                    )}
                    {line.notes && (
                      <span className="text-muted-foreground block text-xs">{line.notes}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(line.quantity, line.unitCode)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(line.scrapRate) ? `%${Number(line.scrapRate).toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(line.quantityPer).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(line.unitCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(line.lineCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(line.onHand)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlanCard bom={bom} />

      {ordering && (
        <WorkOrderDialog
          open
          onOpenChange={setOrdering}
          bomId={bom.id}
          quantity={String(Number(bom.quantity))}
          onSaved={(order) =>
            void navigate({ to: '/production/work-orders/$id', params: { id: order.id } })
          }
        />
      )}
    </>
  );
}

function CostCard({ bom }: { bom: BomDetailDto }) {
  const { t } = useTranslation();
  const batch = Number(bom.quantity);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('production.cost.perBatch', { quantity: formatQuantity(batch, bom.unitCode) })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">
          <Field label={t('production.cost.material')}>
            <span className="tabular-nums">{formatMoney(bom.materialCost)}</span>
          </Field>
          <Field label={t('production.cost.labor')}>
            <span className="tabular-nums">{formatMoney(bom.laborCost)}</span>
          </Field>
          <Field label={t('production.cost.overhead')}>
            <span className="tabular-nums">{formatMoney(bom.overheadCost)}</span>
          </Field>
          <Field label={t('production.cost.standardUnit')}>
            <span className="text-base font-semibold tabular-nums">
              {formatMoney(bom.unitCost)}
            </span>
          </Field>
        </dl>
      </CardContent>
    </Card>
  );
}

/** Multi-level explosion for a quantity: stock is allocated down the tree, shortages flagged. */
function PlanCard({ bom }: { bom: BomDetailDto }) {
  const { t } = useTranslation();
  const warehouses = useWarehouseOptions();
  const [quantityText, setQuantityText] = useState(String(Number(bom.quantity)));
  const [warehouseId, setWarehouseId] = useState(ALL_WAREHOUSES);
  const debounced = useDebouncedValue(quantityText, 300);
  const quantity = parseDecimal(debounced);
  const valid = quantity > 0;
  const { data: plan, isFetching } = useProductionPlanBom(
    bom.id,
    { quantity, warehouseId: warehouseId === ALL_WAREHOUSES ? undefined : warehouseId },
    { query: { enabled: valid } },
  );
  const shortages = plan?.lines.filter((line) => Number(line.shortage) > 0 && !line.made).length;

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{t('production.plan.title')}</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">{t('production.plan.hint')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="plan-quantity">{t('production.quantity')}</Label>
            <Input
              id="plan-quantity"
              type="number"
              min={0}
              step="any"
              className="w-28"
              value={quantityText}
              onChange={(e) => setQuantityText(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('production.plan.warehouse')}</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-44" aria-label={t('production.plan.warehouse')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_WAREHOUSES}>{t('production.plan.allWarehouses')}</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(isFetching && 'opacity-70')}>
        {!valid ? (
          <p className="text-muted-foreground text-sm">{t('production.plan.enterQuantity')}</p>
        ) : !plan ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <Field label={t('production.cost.material')}>
                <span className="tabular-nums">{formatMoney(plan.materialCost)}</span>
              </Field>
              <Field label={t('production.cost.labor')}>
                <span className="tabular-nums">{formatMoney(plan.laborCost)}</span>
              </Field>
              <Field label={t('production.cost.overhead')}>
                <span className="tabular-nums">{formatMoney(plan.overheadCost)}</span>
              </Field>
              <Field label={t('production.cost.total')}>
                <span className="font-semibold tabular-nums">{formatMoney(plan.totalCost)}</span>
              </Field>
            </div>
            <p
              className={cn(
                'mb-2 text-sm font-medium',
                shortages
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {shortages
                ? t('production.plan.shortages', { count: shortages })
                : t('production.plan.ready')}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('production.component')}</TableHead>
                  <TableHead className="text-right">{t('production.requiredQty')}</TableHead>
                  <TableHead className="text-right">{t('production.onHand')}</TableHead>
                  <TableHead className="text-right">{t('production.shortage')}</TableHead>
                  <TableHead>{t('production.availabilityLabel')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.lines.map((line, index) => (
                  <TableRow key={`${line.parentId}-${line.variantId}-${index}`}>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-2"
                        style={{ paddingLeft: `${(line.level - 1) * 1.25}rem` }}
                      >
                        {line.level > 1 && <span className="text-muted-foreground">└</span>}
                        <code className="text-muted-foreground text-xs">{line.sku}</code>
                        <span>{line.name}</span>
                        {line.made && <ToneBadge tone="info">{t('production.made')}</ToneBadge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(line.required, line.unitCode)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(line.onHand)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        Number(line.shortage) > 0 && 'text-destructive font-medium',
                      )}
                    >
                      {Number(line.shortage) > 0 ? formatQuantity(line.shortage) : '—'}
                    </TableCell>
                    <TableCell>
                      <AvailabilityBadge availability={line.availability} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
