import { Link, useNavigate } from '@tanstack/react-router';
import { ClipboardList, Loader2, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useProductionCreatePurchaseRequest,
  useProductionRequirements,
} from '@/api/generated/endpoints/production/production';
import type { RequirementDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatMoney, formatQuantity } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { useInvalidateProduction, WorkOrderDialog } from './production-components';

const hasShortage = (row: RequirementDto) => Number(row.shortage) > 0;
const purchasable = (row: RequirementDto) => hasShortage(row) && !row.made;

/**
 * Malzeme ihtiyaç planlaması: open work orders and approved sales orders against stock and
 * what is already on order; shortages become a purchase request or a work order.
 */
export function RequirementsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const invalidate = useInvalidateProduction();
  const [onlyShortages, setOnlyShortages] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ordering, setOrdering] = useState<RequirementDto | null>(null);
  const { data, isLoading } = useProductionRequirements();
  const request = useProductionCreatePurchaseRequest();

  const rows = (data ?? []).filter((row) => !onlyShortages || hasShortage(row));
  const buyable = rows.filter(purchasable);
  const canRequest = can('workflow:start') || can('purchasing:create');
  const canOrder = can('production:update');
  const chosen = buyable.filter((row) => selected.has(row.variantId));
  const estimate = chosen.reduce(
    (sum, row) => sum + Number(row.shortage) * Number(row.purchasePrice ?? 0),
    0,
  );
  const neededBy = chosen
    .map((row) => row.neededBy)
    .filter((date): date is string => !!date)
    .sort()[0];

  const toggle = (variantId: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(variantId);
      else next.delete(variantId);
      return next;
    });

  const createRequest = () =>
    request.mutate(
      {
        data: {
          lines: chosen.map((row) => ({
            variantId: row.variantId,
            quantity: Number(row.shortage),
          })),
          neededBy: neededBy?.slice(0, 10),
        },
      },
      {
        onSuccess: async (created) => {
          toast.success(t('production.mrp.requestCreated', { number: created.number }), {
            action: {
              label: t('production.mrp.openRequest'),
              onClick: () =>
                void navigate({ to: '/purchasing/requests/$id', params: { id: created.id } }),
            },
          });
          setSelected(new Set());
          await invalidate();
        },
      },
    );

  return (
    <>
      <PageHeader
        title={t('production.mrp.title')}
        description={t('production.mrp.subtitle')}
        actions={
          canRequest && (
            <Button onClick={createRequest} disabled={!chosen.length || request.isPending}>
              {request.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
              {t('production.mrp.createRequest', { count: chosen.length })}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="only-shortages" checked={onlyShortages} onCheckedChange={setOnlyShortages} />
          <Label htmlFor="only-shortages">{t('production.mrp.onlyShortages')}</Label>
        </div>
        {chosen.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {t('production.mrp.selection', {
              count: chosen.length,
              amount: formatMoney(estimate),
            })}
          </span>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {onlyShortages ? t('production.mrp.noShortages') : t('production.mrp.empty')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canRequest && (
                    <TableHead className="w-8">
                      <Checkbox
                        aria-label={t('production.mrp.selectAll')}
                        checked={buyable.length > 0 && chosen.length === buyable.length}
                        disabled={!buyable.length}
                        onCheckedChange={(checked) =>
                          setSelected(new Set(checked ? buyable.map((row) => row.variantId) : []))
                        }
                      />
                    </TableHead>
                  )}
                  <TableHead>{t('production.product')}</TableHead>
                  <TableHead className="text-right">{t('production.mrp.gross')}</TableHead>
                  <TableHead className="text-right">{t('production.onHand')}</TableHead>
                  <TableHead className="text-right">{t('production.mrp.incoming')}</TableHead>
                  <TableHead className="text-right">{t('production.shortage')}</TableHead>
                  <TableHead>{t('production.mrp.neededBy')}</TableHead>
                  <TableHead>{t('production.mrp.sources')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.variantId}>
                    {canRequest && (
                      <TableCell>
                        {purchasable(row) && (
                          <Checkbox
                            aria-label={row.sku}
                            checked={selected.has(row.variantId)}
                            onCheckedChange={(checked) => toggle(row.variantId, checked === true)}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="block max-w-72">
                        <span className="line-clamp-1">
                          {row.productName}
                          {row.variantName && ` · ${row.variantName}`}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-2 text-xs">
                          <code>{row.sku}</code>
                          {row.made && <ToneBadge tone="info">{t('production.made')}</ToneBadge>}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(row.gross, row.unitCode)}
                      <span className="text-muted-foreground block text-xs">
                        {t('production.mrp.grossSplit', {
                          production: formatQuantity(row.productionDemand),
                          sales: formatQuantity(row.salesDemand),
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(row.onHand)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(
                        Number(row.purchaseIncoming) + Number(row.productionIncoming),
                      )}
                      {(Number(row.purchaseIncoming) > 0 || Number(row.productionIncoming) > 0) && (
                        <span className="text-muted-foreground block text-xs">
                          {t('production.mrp.incomingSplit', {
                            purchase: formatQuantity(row.purchaseIncoming),
                            production: formatQuantity(row.productionIncoming),
                          })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium tabular-nums',
                        hasShortage(row)
                          ? 'text-destructive'
                          : 'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {hasShortage(row) ? formatQuantity(row.shortage, row.unitCode) : '✓'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(row.neededBy)}</TableCell>
                    <TableCell className="max-w-56">
                      <span className="flex flex-wrap gap-x-2 font-mono text-xs">
                        {row.workOrders.map((order) => (
                          <Link
                            key={order.id}
                            to="/production/work-orders/$id"
                            params={{ id: order.id }}
                            className="text-primary hover:underline"
                          >
                            {order.number}
                          </Link>
                        ))}
                        {row.salesOrders.map((order) => (
                          <Link
                            key={order.id}
                            to="/sales/orders/$id"
                            params={{ id: order.id }}
                            className="text-primary hover:underline"
                          >
                            {order.number}
                          </Link>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {hasShortage(row) && row.made && row.defaultBomId && canOrder && (
                        <Button size="sm" variant="outline" onClick={() => setOrdering(row)}>
                          <ClipboardList /> {t('production.mrp.produce')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {ordering && (
        <WorkOrderDialog
          open
          onOpenChange={(open) => !open && setOrdering(null)}
          bomId={ordering.defaultBomId ?? undefined}
          quantity={String(Number(ordering.shortage))}
        />
      )}
    </>
  );
}
