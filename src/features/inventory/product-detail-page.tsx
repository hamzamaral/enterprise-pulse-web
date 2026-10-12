import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getProductsFindAllQueryKey,
  getProductsFindOneQueryKey,
  useProductsAddVariant,
  useProductsFindOne,
  useProductsRemove,
  useProductsRemoveVariant,
  useProductsUpdateVariant,
  useStockFindLedger,
  useStockFindLots,
  useStockFindSerials,
} from '@/api/generated/endpoints/inventory/inventory';
import type {
  LedgerEntryDto,
  ProductDetailDto,
  SerialDto,
  VariantDto,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { emptyToNull } from '@/features/hr/hr-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { Field, InfoCard } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge, ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatMoney, formatQuantity } from '@/shared/lib/format';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { RecordNotFound } from '@/shared/components/route-error';
import {
  formatAttributes,
  LowStockBadge,
  MovementTypeBadge,
  parseAttributes,
  SignedQuantity,
  TrackingBadge,
} from './inventory-components';
import { ProductFormDialog } from './product-form-dialog';

const SKU = /^[A-Za-z0-9._-]{2,40}$/;

const variantSchema = z.object({
  sku: z.string().trim().regex(SKU, 'validation.sku'),
  name: z.string().trim(),
  attributes: z.string(),
  barcode: z.string().trim(),
  minStock: z.coerce.number({ invalid_type_error: 'validation.number' }).min(0),
  isActive: z.boolean(),
});

function variantLabel(variant: VariantDto, standard: string) {
  return `${variant.sku} · ${variant.name ?? standard}`;
}

function Overview({ product }: { product: ProductDetailDto }) {
  const { t } = useTranslation();
  const variants = new Map(product.variants.map((v) => [v.id, v]));
  const multiple = product.variants.length > 1;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <InfoCard title={t('inventory.products.identity')}>
          <Field label={t('common.code')}>
            <code className="text-xs">{product.code}</code>
          </Field>
          <Field label={t('inventory.category')}>{product.categoryName}</Field>
          <Field label={t('inventory.products.type')}>{t(`inventory.types.${product.type}`)}</Field>
          <Field label={t('inventory.products.tracking')}>
            {t(`inventory.trackingTypes.${product.trackingType}`)}
          </Field>
          <Field label={t('inventory.unit')}>{product.unitCode}</Field>
          <Field label={t('inventory.products.vatRate')}>{product.vatRateName}</Field>
          <Field label={t('inventory.products.purchasePrice')}>
            {product.purchasePrice && formatMoney(product.purchasePrice, product.currency)}
          </Field>
          <Field label={t('inventory.products.salePrice')}>
            {product.salePrice && formatMoney(product.salePrice, product.currency)}
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('common.description')}>{product.description}</Field>
          </div>
        </InfoCard>
      </div>
      {product.type === 'GOODS' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              {t('inventory.products.stockByWarehouse')}
              {product.lowStock && <LowStockBadge />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-muted-foreground text-xs">{t('inventory.onHand')}</div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatQuantity(product.onHand, product.unitCode)}
              </div>
            </div>
            {product.stock.length ? (
              <ul className="divide-y text-sm">
                {product.stock.map((row) => (
                  <li
                    key={`${row.warehouseId}-${row.variantId}`}
                    className="flex justify-between gap-2 py-2"
                  >
                    <span>
                      {row.warehouseName}
                      {multiple && (
                        <span className="text-muted-foreground block text-xs">
                          {variants.get(row.variantId)?.name ?? variants.get(row.variantId)?.sku}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">{formatQuantity(row.quantity)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t('inventory.products.noStock')}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VariantsTab({ product }: { product: ProductDetailDto }) {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidate = useInvalidate();
  const add = useProductsAddVariant();
  const update = useProductsUpdateVariant();
  const remove = useProductsRemoveVariant();
  const [editor, setEditor] = useState<{ open: boolean; item: VariantDto | null }>({
    open: false,
    item: null,
  });
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getProductsFindOneQueryKey(product.id), getProductsFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<VariantDto, unknown>[]>(
    () => [
      {
        id: 'sku',
        header: t('inventory.sku'),
        cell: ({ row }) => <code className="text-xs">{row.original.sku}</code>,
      },
      {
        id: 'name',
        header: t('inventory.variant'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {row.original.name ?? t('inventory.standardVariant')}
            </span>
            {row.original.isDefault && product.variants.length > 1 && (
              <ToneBadge tone="neutral">{t('inventory.products.default')}</ToneBadge>
            )}
          </div>
        ),
      },
      {
        id: 'attributes',
        header: t('inventory.products.attributes'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {Object.entries(row.original.attributes ?? {}).map(([key, value]) => (
              <span key={key} className="bg-muted rounded px-1.5 py-0.5 text-xs">
                {key}: {value}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: 'barcode',
        header: t('inventory.barcode'),
        cell: ({ row }) => row.original.barcode ?? '—',
      },
      {
        id: 'minStock',
        header: t('inventory.minStock'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatQuantity(row.original.minStock)}</span>
        ),
      },
      {
        id: 'averageCost',
        header: t('inventory.averageCost'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.averageCost)}</span>
        ),
      },
      {
        id: 'onHand',
        header: t('inventory.onHand'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2 tabular-nums">
            {formatQuantity(row.original.onHand, product.unitCode)}
            {row.original.lowStock && <LowStockBadge />}
          </span>
        ),
      },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      ...(can('inventory:update')
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }: { row: { original: VariantDto } }) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t('common.edit')}
                    onClick={() => setEditor({ open: true, item: row.original })}
                  >
                    <Pencil />
                  </Button>
                  {product.variants.length > 1 && (
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive size-8"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 />
                        </Button>
                      }
                      onConfirm={() =>
                        remove.mutate({ id: product.id, variantId: row.original.id }, { onSuccess })
                      }
                    />
                  )}
                </div>
              ),
            } satisfies ColumnDef<VariantDto, unknown>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, product, can],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={product.variants}
        searchable={false}
        toolbar={
          product.type === 'GOODS' && (
            <Can permission="inventory:update">
              <Button size="sm" onClick={() => setEditor({ open: true, item: null })}>
                <Plus /> {t('inventory.products.newVariant')}
              </Button>
            </Can>
          )
        }
      />
      <SimpleFormDialog<z.infer<typeof variantSchema>>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={
          editor.item
            ? variantLabel(editor.item, t('inventory.standardVariant'))
            : t('inventory.products.newVariant')
        }
        schema={variantSchema}
        pending={add.isPending || update.isPending}
        defaultValues={{
          sku: editor.item?.sku ?? `${product.code}-`,
          name: editor.item?.name ?? '',
          attributes: formatAttributes(editor.item?.attributes),
          barcode: editor.item?.barcode ?? '',
          minStock: editor.item ? Number(editor.item.minStock) : 0,
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'sku', label: t('inventory.sku') },
          { name: 'name', label: t('inventory.variant'), placeholder: 'Siyah / M' },
          {
            name: 'attributes',
            label: t('inventory.products.attributes'),
            placeholder: t('inventory.products.attributesHint'),
            wide: true,
          },
          { name: 'barcode', label: t('inventory.barcode') },
          { name: 'minStock', label: t('inventory.minStock'), type: 'number' },
          ...(editor.item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={(values) => {
          const data = {
            sku: values.sku,
            attributes: parseAttributes(values.attributes),
            barcode: emptyToNull(values.barcode),
            minStock: values.minStock,
          };
          if (editor.item) {
            update.mutate(
              {
                id: product.id,
                variantId: editor.item.id,
                data: { ...data, name: emptyToNull(values.name), isActive: values.isActive },
              },
              { onSuccess },
            );
          } else {
            add.mutate(
              { id: product.id, data: { ...data, name: values.name || values.sku } },
              { onSuccess },
            );
          }
        }}
      />
    </>
  );
}

function VariantSelect({
  product,
  value,
  onChange,
}: {
  product: ProductDetailDto;
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (product.variants.length < 2) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {product.variants.map((variant) => (
          <SelectItem key={variant.id} value={variant.id}>
            {variantLabel(variant, t('inventory.standardVariant'))}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StockCardTab({ product, variantId }: { product: ProductDetailDto; variantId: string }) {
  const { t } = useTranslation();
  const table = useTableState({ pageSize: 20 });
  const { data, isLoading } = useStockFindLedger(
    { page: table.params.page, pageSize: table.params.pageSize, variantId },
    { query: tableQuery },
  );
  const columns = useMemo<ColumnDef<LedgerEntryDto, unknown>[]>(
    () => [
      {
        id: 'movementDate',
        header: t('inventory.movements.date'),
        cell: ({ row }) => formatDate(row.original.movementDate),
      },
      {
        id: 'movementNumber',
        header: t('inventory.movements.number'),
        cell: ({ row }) => (
          <Link
            to="/inventory/movements/$id"
            params={{ id: row.original.movementId }}
            className="text-primary text-xs hover:underline"
          >
            <code>{row.original.movementNumber}</code>
          </Link>
        ),
      },
      {
        id: 'movementType',
        header: t('inventory.movements.type'),
        cell: ({ row }) => <MovementTypeBadge type={row.original.movementType} />,
      },
      {
        id: 'warehouse',
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouseName,
      },
      ...(product.trackingType === 'LOT'
        ? [
            {
              id: 'lotNo',
              header: t('inventory.movements.lot'),
              cell: ({ row }: { row: { original: LedgerEntryDto } }) => row.original.lotNo ?? '—',
            },
          ]
        : []),
      {
        id: 'quantity',
        header: t('inventory.quantity'),
        cell: ({ row }) => <SignedQuantity value={row.original.quantity} />,
      },
      {
        id: 'unitCost',
        header: t('inventory.movements.unitCost'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.unitCost)}</span>
        ),
      },
      {
        id: 'balanceAfter',
        header: t('inventory.movements.balanceAfter'),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatQuantity(row.original.balanceAfter, product.unitCode)}
          </span>
        ),
      },
    ],
    [t, product],
  );
  return (
    <DataTable
      columns={columns}
      data={data?.data}
      meta={data?.meta}
      isLoading={isLoading}
      state={table}
      searchable={false}
    />
  );
}

function LotsTab({ variantId, unit }: { variantId: string; unit: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = useStockFindLots({ variantId });
  if (isLoading) return <Skeleton className="h-32" />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('inventory.movements.lot')}</TableHead>
              <TableHead>{t('inventory.movements.expiryDate')}</TableHead>
              <TableHead>{t('inventory.warehouse')}</TableHead>
              <TableHead className="text-right">{t('inventory.onHand')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length ? (
              data.map((lot) => {
                const expired = lot.expiryDate && new Date(lot.expiryDate) < new Date();
                return (
                  <TableRow key={`${lot.lotId}-${lot.warehouseId}`}>
                    <TableCell>
                      <code className="text-xs">{lot.lotNo}</code>
                    </TableCell>
                    <TableCell className={expired ? 'text-destructive' : undefined}>
                      {formatDate(lot.expiryDate)}
                    </TableCell>
                    <TableCell>{lot.warehouseName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(lot.quantity, unit)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-20 text-center">
                  {t('common.noResults')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SerialsTab({ variantId }: { variantId: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = useStockFindSerials({ variantId });
  const columns = useMemo<ColumnDef<SerialDto, unknown>[]>(
    () => [
      {
        id: 'serialNo',
        header: t('inventory.movements.serialNo'),
        cell: ({ row }) => <code className="text-xs">{row.original.serialNo}</code>,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <ToneBadge tone={row.original.status === 'IN_STOCK' ? 'success' : 'neutral'}>
            {t(`inventory.serialStatus.${row.original.status}`)}
          </ToneBadge>
        ),
      },
      {
        id: 'warehouse',
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouseName ?? '—',
      },
    ],
    [t],
  );
  return <DataTable columns={columns} data={data} isLoading={isLoading} searchable={false} />;
}

export function ProductDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: product, isLoading } = useProductsFindOne(id);
  const remove = useProductsRemove();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');

  if (!product) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const variantId = selectedVariant ?? product.variants[0]?.id;
  const stocked = product.type === 'GOODS';

  return (
    <>
      <Link
        to="/inventory/products"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('inventory.products.title')}
      </Link>
      <PageHeader
        title={product.name}
        description={[product.code, product.categoryName].filter(Boolean).join(' · ')}
        actions={
          <>
            <TrackingBadge tracking={product.trackingType} />
            <ActiveBadge active={product.isActive} />
            <Can permission="inventory:update">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> {t('common.edit')}
              </Button>
            </Can>
            {!product.hasTransactions && (
              <Can permission="inventory:delete">
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
                          await invalidate(getProductsFindAllQueryKey());
                          await navigate({ to: '/inventory/products' });
                        },
                      },
                    )
                  }
                />
              </Can>
            )}
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="overview">{t('inventory.products.overview')}</TabsTrigger>
            <TabsTrigger value="variants">
              {t('inventory.products.variants')} ({product.variants.length})
            </TabsTrigger>
            {stocked && (
              <TabsTrigger value="ledger">{t('inventory.products.stockCard')}</TabsTrigger>
            )}
            {product.trackingType === 'LOT' && (
              <TabsTrigger value="lots">{t('inventory.products.lots')}</TabsTrigger>
            )}
            {product.trackingType === 'SERIAL' && (
              <TabsTrigger value="serials">{t('inventory.products.serials')}</TabsTrigger>
            )}
          </TabsList>
          {stocked && variantId && ['ledger', 'lots', 'serials'].includes(tab) && (
            <VariantSelect product={product} value={variantId} onChange={setSelectedVariant} />
          )}
        </div>
        <TabsContent value="overview">
          <Overview product={product} />
        </TabsContent>
        <TabsContent value="variants">
          <VariantsTab product={product} />
        </TabsContent>
        {stocked && variantId && (
          <>
            <TabsContent value="ledger">
              <StockCardTab product={product} variantId={variantId} />
            </TabsContent>
            <TabsContent value="lots">
              <LotsTab variantId={variantId} unit={product.unitCode} />
            </TabsContent>
            <TabsContent value="serials">
              <SerialsTab variantId={variantId} />
            </TabsContent>
          </>
        )}
      </Tabs>
      <ProductFormDialog open={editOpen} onOpenChange={setEditOpen} product={product} />
    </>
  );
}
