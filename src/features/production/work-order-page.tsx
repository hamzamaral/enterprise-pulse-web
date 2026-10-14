import { Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, CheckCheck, Factory, Loader2, Pencil, Play } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useProductionCancel,
  useProductionComplete,
  useProductionFindWorkOrder,
  useProductionRelease,
} from '@/api/generated/endpoints/production/production';
import type { WorkOrderDetailDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { ProgressBar } from '@/features/projects/project-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import {
  AvailabilityBadge,
  RecordDialog,
  useInvalidateProduction,
  WorkOrderDialog,
  WorkOrderStatusBadge,
} from './production-components';
import { remainingOutput } from './production-rules';

export function WorkOrderPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidate = useInvalidateProduction();
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const { data: order, isLoading } = useProductionFindWorkOrder(id);
  const release = useProductionRelease();
  const complete = useProductionComplete();
  const cancel = useProductionCancel();

  if (!order) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const canUpdate = can('production:update');
  const run =
    (
      mutation: typeof release,
      message:
        | 'production.workOrder.released'
        | 'production.workOrder.completed'
        | 'production.workOrder.cancelled',
    ) =>
    () =>
      mutation.mutate(
        { id },
        {
          onSuccess: async (saved: WorkOrderDetailDto) => {
            toast.success(t(message, { number: saved.number }));
            await invalidate();
          },
        },
      );
  const busy = release.isPending || complete.isPending || cancel.isPending;
  const remaining = remainingOutput(order);
  const short = Number(order.buildable) < remaining;

  return (
    <>
      <Link
        to="/production"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('production.title')}
      </Link>
      <PageHeader
        title={order.number}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {order.productName}
              {order.variantName && ` · ${order.variantName}`}
            </span>
            <WorkOrderStatusBadge status={order.status} />
            {order.late && <ToneBadge tone="danger">{t('production.workOrder.late')}</ToneBadge>}
          </span>
        }
        actions={
          <>
            {order.canEdit && canUpdate && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            {order.canCancel && canUpdate && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={busy}>
                    <Ban /> {t('production.workOrder.cancel')}
                  </Button>
                }
                title={t('production.workOrder.cancelTitle')}
                description={t('production.workOrder.cancelDescription')}
                confirmLabel={t('production.workOrder.cancel')}
                onConfirm={run(cancel, 'production.workOrder.cancelled')}
              />
            )}
            {order.canComplete && canUpdate && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={busy}>
                    <CheckCheck /> {t('production.workOrder.complete')}
                  </Button>
                }
                title={t('production.workOrder.completeTitle')}
                description={t('production.workOrder.completeDescription', {
                  produced: formatQuantity(order.producedQty, order.unitCode),
                  quantity: formatQuantity(order.quantity, order.unitCode),
                })}
                confirmLabel={t('production.workOrder.complete')}
                onConfirm={run(complete, 'production.workOrder.completed')}
              />
            )}
            {order.canRelease && canUpdate && (
              <Button onClick={run(release, 'production.workOrder.released')} disabled={busy}>
                {release.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                {t('production.workOrder.release')}
              </Button>
            )}
            {order.canRecord && can('production:record') && (
              <Button onClick={() => setRecording(true)}>
                <Factory /> {t('production.record.action')}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('production.workOrder.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('production.product')}>
                <span className="font-mono text-xs">{order.sku}</span>
              </Field>
              <Field label={t('production.bom.title')}>
                <Link
                  to="/production/boms/$id"
                  params={{ id: order.bomId }}
                  className="text-primary font-mono text-xs hover:underline"
                >
                  {order.bomCode}
                </Link>
              </Field>
              <Field label={t('production.workOrder.reference')}>{order.reference}</Field>
              <Field label={t('production.workOrder.produced')}>
                <span className="tabular-nums">
                  {formatQuantity(order.producedQty)} /{' '}
                  {formatQuantity(order.quantity, order.unitCode)}
                </span>
                <ProgressBar value={order.progress} className="mt-1" />
              </Field>
              <Field label={t('production.workOrder.plannedStart')}>
                {formatDate(order.plannedStart)}
              </Field>
              <Field label={t('production.workOrder.plannedEnd')}>
                <span className={order.late ? 'text-destructive font-medium' : undefined}>
                  {formatDate(order.plannedEnd)}
                </span>
              </Field>
              <Field label={t('production.workOrder.sourceWarehouse')}>
                {order.sourceWarehouseName}
              </Field>
              <Field label={t('production.workOrder.targetWarehouse')}>
                {order.targetWarehouseName}
              </Field>
              <Field label={t('production.createdBy')}>{order.createdByName}</Field>
              {order.releasedAt && (
                <Field label={t('production.workOrder.releasedAt')}>
                  {formatDateTime(order.releasedAt)}
                </Field>
              )}
              {order.startedAt && (
                <Field label={t('production.workOrder.startedAt')}>
                  {formatDateTime(order.startedAt)}
                </Field>
              )}
              {order.completedAt && (
                <Field label={t('production.workOrder.completedAt')}>
                  {formatDateTime(order.completedAt)}
                </Field>
              )}
              {order.cancelledAt && (
                <Field label={t('production.workOrder.cancelledAt')}>
                  {formatDateTime(order.cancelledAt)}
                </Field>
              )}
            </dl>
            {order.notes && (
              <p className="text-muted-foreground mt-4 text-sm whitespace-pre-line">
                {order.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('production.cost.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Field label={t('production.cost.standardUnit')}>
                <span className="tabular-nums">{formatMoney(order.standardUnitCost)}</span>
              </Field>
              <Field label={t('production.cost.actualUnit')}>
                {order.actualUnitCost && (
                  <span className="tabular-nums">{formatMoney(order.actualUnitCost)}</span>
                )}
              </Field>
              <Field label={t('production.cost.laborPerUnit')}>
                <span className="tabular-nums">{formatMoney(order.laborPerUnit)}</span>
              </Field>
              <Field label={t('production.cost.overheadPerUnit')}>
                <span className="tabular-nums">{formatMoney(order.overheadPerUnit)}</span>
              </Field>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">{t('production.workOrder.materials')}</CardTitle>
          {order.canRecord && (
            <span
              className={
                short
                  ? 'text-sm font-medium text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground text-sm'
              }
            >
              {t('production.workOrder.buildable', {
                value: formatQuantity(order.buildable, order.unitCode),
                warehouse: order.sourceWarehouseName,
              })}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('production.component')}</TableHead>
                <TableHead className="text-right">{t('production.perUnit')}</TableHead>
                <TableHead className="text-right">{t('production.requiredQty')}</TableHead>
                <TableHead className="text-right">{t('production.consumedQty')}</TableHead>
                <TableHead className="text-right">{t('production.remaining')}</TableHead>
                <TableHead className="text-right">{t('production.onHand')}</TableHead>
                <TableHead>{t('production.availabilityLabel')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.components.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <code className="text-muted-foreground mr-2 text-xs">{c.sku}</code>
                    {c.productName}
                    {c.variantName && ` · ${c.variantName}`}
                    {c.lotTracked && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {t('production.lotTracked')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(c.quantityPer).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(c.requiredQty, c.unitCode)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(c.consumedQty)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(c.remainingQty)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(c.onHand)}
                  </TableCell>
                  <TableCell>
                    {Number(c.remainingQty) > 0 ? (
                      <AvailabilityBadge availability={c.availability} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{t('production.record.list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {order.records.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('production.record.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('production.record.number')}</TableHead>
                  <TableHead>{t('production.record.date')}</TableHead>
                  <TableHead className="text-right">{t('production.quantity')}</TableHead>
                  <TableHead className="text-right">{t('production.cost.material')}</TableHead>
                  <TableHead className="text-right">{t('production.cost.laborOverhead')}</TableHead>
                  <TableHead className="text-right">{t('production.cost.unit')}</TableHead>
                  <TableHead>{t('production.record.movements')}</TableHead>
                  <TableHead>{t('production.createdBy')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.number}
                      {r.lotNo && (
                        <span className="text-muted-foreground block">
                          {t('production.record.lot', { lot: r.lotNo })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(r.recordDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(r.quantity, order.unitCode)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.materialCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(Number(r.laborCost) + Number(r.overheadCost))}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(r.unitCost)}
                    </TableCell>
                    <TableCell className="space-x-2 font-mono text-xs whitespace-nowrap">
                      {r.issueMovementId && (
                        <Link
                          to="/inventory/movements/$id"
                          params={{ id: r.issueMovementId }}
                          className="text-primary hover:underline"
                        >
                          {r.issueMovementNumber}
                        </Link>
                      )}
                      <Link
                        to="/inventory/movements/$id"
                        params={{ id: r.receiptMovementId }}
                        className="text-primary hover:underline"
                      >
                        {r.receiptMovementNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.createdByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && <WorkOrderDialog open onOpenChange={setEditing} order={order} />}
      {recording && <RecordDialog open onOpenChange={setRecording} order={order} />}
    </>
  );
}
