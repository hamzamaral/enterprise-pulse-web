import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  Download,
  Pencil,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getAssetsFindAllQueryKey,
  getAssetsFindOneQueryKey,
  useAssetAssignmentsFindAll,
  useAssetsFindOne,
  useAssetsRemove,
  useAssetsRetire,
} from '@/api/generated/endpoints/assets/assets';
import { RetireAssetDtoStatus, type AssetDetailDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Assignee, AssetStatusBadge, ConditionBadge } from './asset-components';
import { AssetFormDialog } from './asset-form-dialog';
import { AssetMaintenanceTab } from './asset-maintenance';
import { AssignDialog, ReturnDialog } from './assignment-dialogs';
import { AssignmentsTable } from './assignments-table';

const retireSchema = z.object({
  status: z.nativeEnum(RetireAssetDtoStatus),
  reason: z.string().trim().min(2, 'validation.required'),
});

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children || '—'}</dd>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
      </CardContent>
    </Card>
  );
}

function warrantyState(endDate: string | null) {
  if (!endDate) return null;
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'expired';
  return days <= 60 ? 'expiring' : 'active';
}

/** QR label encoding the asset's URL, so scanning it opens this page. */
function QrLabel({ asset }: { asset: AssetDetailDto }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${window.location.origin}/assets/${asset.id}`;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${asset.assetTag}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('assets.qrLabel')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <div className="rounded-md border bg-white p-3">
          <QRCodeCanvas ref={canvasRef} value={url} size={148} marginSize={1} />
        </div>
        <div className="text-center">
          <code className="text-sm font-semibold">{asset.assetTag}</code>
          <div className="text-muted-foreground text-xs">{asset.name}</div>
        </div>
        <Button variant="outline" size="sm" onClick={download}>
          <Download /> {t('assets.downloadLabel')}
        </Button>
      </CardContent>
    </Card>
  );
}

function DepreciationCard({ asset }: { asset: AssetDetailDto }) {
  const { t } = useTranslation();
  const dep = asset.depreciation;
  if (!dep) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('assets.depreciation')}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {t('assets.noDepreciation')}
        </CardContent>
      </Card>
    );
  }
  const progress = Math.min(100, (dep.elapsedMonths / dep.usefulLifeMonths) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('assets.depreciation')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-muted-foreground text-xs">{t('assets.bookValue')}</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatMoney(dep.bookValue, asset.currency)}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>
              {t('assets.elapsedMonths', {
                elapsed: Math.min(dep.elapsedMonths, dep.usefulLifeMonths),
                total: dep.usefulLifeMonths,
              })}
            </span>
            {dep.fullyDepreciated && <span>{t('assets.fullyDepreciated')}</span>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <Field label={t('assets.purchaseCost')}>
            {formatMoney(asset.purchaseCost, asset.currency)}
          </Field>
          <Field label={t('assets.salvageValue')}>
            {formatMoney(asset.salvageValue, asset.currency)}
          </Field>
          <Field label={t('assets.monthlyDepreciation')}>
            {formatMoney(dep.monthlyAmount, asset.currency)}
          </Field>
          <Field label={t('assets.accumulated')}>
            {formatMoney(dep.accumulated, asset.currency)}
          </Field>
        </dl>
      </CardContent>
    </Card>
  );
}

function Overview({ asset }: { asset: AssetDetailDto }) {
  const { t } = useTranslation();
  const warranty = warrantyState(asset.warrantyEndDate);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <InfoCard title={t('assets.identity')}>
          <Field label={t('assets.assetTag')}>
            <code className="text-xs">{asset.assetTag}</code>
          </Field>
          <Field label={t('assets.category')}>{asset.categoryName}</Field>
          <Field label={t('assets.brand')}>{asset.brand}</Field>
          <Field label={t('assets.model')}>{asset.model}</Field>
          <Field label={t('assets.serialNumber')}>{asset.serialNumber}</Field>
          <Field label={t('assets.condition')}>
            <ConditionBadge condition={asset.condition} />
          </Field>
          <Field label={t('assets.holder')}>
            {asset.holder && (
              <Link
                to="/assets/assignments/$id"
                params={{ id: asset.holder.assignmentId }}
                className="text-primary hover:underline"
              >
                <Assignee type={asset.holder.type} name={asset.holder.name} />
              </Link>
            )}
          </Field>
          <Field label={t('assets.location')}>{asset.locationName}</Field>
          {asset.retiredAt && (
            <>
              <Field label={t('assets.retiredAt')}>{formatDate(asset.retiredAt)}</Field>
              <Field label={t('assets.retireReason')}>{asset.retireReason}</Field>
            </>
          )}
        </InfoCard>
        <InfoCard title={t('assets.purchase')}>
          <Field label={t('assets.purchaseDate')}>
            {asset.purchaseDate && formatDate(asset.purchaseDate)}
          </Field>
          <Field label={t('assets.purchaseCost')}>
            {asset.purchaseCost && formatMoney(asset.purchaseCost, asset.currency)}
          </Field>
          <Field label={t('assets.supplier')}>{asset.supplier}</Field>
          <Field label={t('assets.invoiceNo')}>{asset.invoiceNo}</Field>
          <Field label={t('assets.warrantyEndDate')}>
            {asset.warrantyEndDate && (
              <span className="flex items-center gap-2">
                {formatDate(asset.warrantyEndDate)}
                {warranty && (
                  <span
                    className={
                      warranty === 'expired'
                        ? 'text-muted-foreground text-xs'
                        : warranty === 'expiring'
                          ? 'text-xs text-amber-600'
                          : 'text-xs text-emerald-600'
                    }
                  >
                    ({t(`assets.warranty.${warranty}`)})
                  </span>
                )}
              </span>
            )}
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('common.notes')}>{asset.notes}</Field>
          </div>
        </InfoCard>
      </div>
      <div className="space-y-4">
        <QrLabel asset={asset} />
        <DepreciationCard asset={asset} />
      </div>
    </div>
  );
}

function DepreciationSchedule({ asset }: { asset: AssetDetailDto }) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  if (!asset.depreciation) {
    return <p className="text-muted-foreground text-sm">{t('assets.noDepreciation')}</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('assets.year')}</TableHead>
              <TableHead className="text-right">{t('assets.months')}</TableHead>
              <TableHead className="text-right">{t('assets.annualDepreciation')}</TableHead>
              <TableHead className="text-right">{t('assets.bookValueEnd')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asset.depreciation.schedule.map((row) => (
              <TableRow key={row.year} className={row.year === currentYear ? 'bg-primary/5' : ''}>
                <TableCell className="font-medium">{row.year}</TableCell>
                <TableCell className="text-right tabular-nums">{row.months}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.depreciation, asset.currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.bookValueEnd, asset.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AssignmentHistory({ assetId }: { assetId: string }) {
  const table = useTableState({ pageSize: 10, sort: [{ id: 'assignedAt', desc: true }] });
  const { data, isLoading } = useAssetAssignmentsFindAll(
    { ...table.params, assetId },
    { query: tableQuery },
  );
  return (
    <AssignmentsTable
      data={data?.data}
      meta={data?.meta}
      isLoading={isLoading}
      state={table}
      hideAsset
    />
  );
}

type Dialog = 'edit' | 'assign' | 'transfer' | 'return' | 'retire' | null;

export function AssetDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: asset, isLoading } = useAssetsFindOne(id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const retire = useAssetsRetire();
  const remove = useAssetsRemove();
  const close = (open: boolean) => !open && setDialog(null);

  if (isLoading || !asset) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const inService = asset.status !== 'RETIRED' && asset.status !== 'LOST';

  return (
    <>
      <Link
        to="/assets"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('assets.title')}
      </Link>
      <PageHeader
        title={asset.name}
        description={[asset.assetTag, asset.brand, asset.model].filter(Boolean).join(' · ')}
        actions={
          <>
            <AssetStatusBadge status={asset.status} />
            <Can permission="assets:assign">
              {asset.status === 'IN_STOCK' && (
                <Button onClick={() => setDialog('assign')}>
                  <UserPlus /> {t('assets.assign')}
                </Button>
              )}
              {asset.status === 'ASSIGNED' && (
                <>
                  <Button variant="outline" onClick={() => setDialog('transfer')}>
                    <ArrowLeftRight /> {t('assets.transfer')}
                  </Button>
                  <Button variant="outline" onClick={() => setDialog('return')}>
                    <Undo2 /> {t('assets.return')}
                  </Button>
                </>
              )}
            </Can>
            <Can permission="assets:update">
              {inService && (
                <Button variant="outline" onClick={() => setDialog('edit')}>
                  <Pencil /> {t('common.edit')}
                </Button>
              )}
              {asset.status === 'IN_STOCK' && (
                <Button variant="outline" onClick={() => setDialog('retire')}>
                  <Ban /> {t('assets.retire')}
                </Button>
              )}
            </Can>
            <Can permission="assets:delete">
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                onConfirm={() =>
                  remove.mutate(
                    { id },
                    {
                      onSuccess: async () => {
                        toast.success(t('common.deleted'));
                        await invalidate(getAssetsFindAllQueryKey());
                        await navigate({ to: '/assets' });
                      },
                    },
                  )
                }
              />
            </Can>
          </>
        }
      />
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">{t('assets.overview')}</TabsTrigger>
          <TabsTrigger value="depreciation">{t('assets.depreciationSchedule')}</TabsTrigger>
          <TabsTrigger value="history">{t('assets.history')}</TabsTrigger>
          <TabsTrigger value="maintenance">{t('assets.maintenance')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview asset={asset} />
        </TabsContent>
        <TabsContent value="depreciation">
          <DepreciationSchedule asset={asset} />
        </TabsContent>
        <TabsContent value="history">
          <AssignmentHistory assetId={asset.id} />
        </TabsContent>
        <TabsContent value="maintenance">
          <AssetMaintenanceTab asset={asset} />
        </TabsContent>
      </Tabs>

      {can('assets:update') && (
        <AssetFormDialog open={dialog === 'edit'} onOpenChange={close} asset={asset} />
      )}
      <AssignDialog
        open={dialog === 'assign' || dialog === 'transfer'}
        onOpenChange={close}
        asset={asset}
        mode={dialog === 'transfer' ? 'transfer' : 'assign'}
      />
      <ReturnDialog open={dialog === 'return'} onOpenChange={close} asset={asset} />
      <SimpleFormDialog<z.infer<typeof retireSchema>>
        open={dialog === 'retire'}
        onOpenChange={close}
        title={t('assets.retireTitle')}
        schema={retireSchema}
        pending={retire.isPending}
        defaultValues={{ status: RetireAssetDtoStatus.RETIRED, reason: '' }}
        fields={[
          {
            name: 'status',
            label: t('common.status'),
            type: 'select',
            required: true,
            wide: true,
            options: Object.values(RetireAssetDtoStatus).map((s) => ({
              value: s,
              label: t(`assets.status.${s}`),
            })),
          },
          { name: 'reason', label: t('assets.retireReason'), type: 'textarea', wide: true },
        ]}
        onSubmit={(values) =>
          retire.mutate(
            { id, data: values },
            {
              onSuccess: async () => {
                toast.success(t('assets.retired'));
                await invalidate(getAssetsFindOneQueryKey(id), getAssetsFindAllQueryKey());
                setDialog(null);
              },
            },
          )
        }
      />
    </>
  );
}
