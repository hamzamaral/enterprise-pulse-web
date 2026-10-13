import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useBudgetItemsCreate,
  useBudgetItemsFindAll,
  useBudgetItemsOptions,
  useBudgetItemsRemove,
  useBudgetItemsUpdate,
} from '@/api/generated/endpoints/budgets/budgets';
import type { BudgetItemDto, BudgetItemKind, BudgetSource } from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { ActiveBadge } from '@/shared/components/status-badge';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
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
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import { useInvalidateBudgets } from './budget-components';

const KINDS: BudgetItemKind[] = ['INCOME', 'EXPENSE'];
const SOURCES: BudgetSource[] = ['MANUAL', 'EXPENSES', 'PAYROLL', 'PURCHASES', 'SALES'];
const CODE_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

/** The kind a source's actuals always have; manual items may be either. */
const SOURCE_KIND: Partial<Record<BudgetSource, BudgetItemKind>> = {
  EXPENSES: 'EXPENSE',
  PAYROLL: 'EXPENSE',
  PURCHASES: 'EXPENSE',
  SALES: 'INCOME',
};
const hasCategories = (source: BudgetSource) => source === 'EXPENSES' || source === 'PURCHASES';

/** Budget items and where their actuals come from. */
export function BudgetItemsPage() {
  const { t } = useTranslation();
  const invalidate = useInvalidateBudgets();
  const { data, isLoading } = useBudgetItemsFindAll();
  const remove = useBudgetItemsRemove();
  const [editor, setEditor] = useState<{ open: boolean; item: BudgetItemDto | null }>({
    open: false,
    item: null,
  });

  const columns = useMemo<ColumnDef<BudgetItemDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('budgets.item'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">
              <code className="text-muted-foreground mr-1 text-xs">{row.original.code}</code>
              {row.original.name}
            </span>
            {row.original.description && (
              <span className="text-muted-foreground block text-xs">
                {row.original.description}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'kind',
        header: t('budgets.kindLabel'),
        cell: ({ row }) => t(`budgets.kind.${row.original.kind}`),
      },
      {
        id: 'source',
        header: t('budgets.sourceLabel'),
        cell: ({ row }) => (
          <span>
            {t(`budgets.source.${row.original.source}`)}
            {hasCategories(row.original.source) && (
              <span className="text-muted-foreground block max-w-80 text-xs">
                {row.original.categories.length
                  ? row.original.categories.map((c) => c.name).join(', ')
                  : t('budgets.items.catchAll')}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'usage',
        header: t('budgets.items.usage'),
        cell: ({ row }) => (
          <span className="text-sm">
            {t('budgets.items.budgetCount', { count: row.original.budgetCount })}
            <span className="text-muted-foreground block text-xs">
              {t('budgets.items.entryCount', { count: row.original.entryCount })}
            </span>
          </span>
        ),
      },
      {
        id: 'active',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.budgetCount === 0 &&
          row.original.entryCount === 0 && (
            <span onClick={(e) => e.stopPropagation()}>
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 />
                  </Button>
                }
                onConfirm={() =>
                  remove.mutate(
                    { id: row.original.id },
                    {
                      onSuccess: async () => {
                        toast.success(t('budgets.items.deleted'));
                        await invalidate();
                      },
                    },
                  )
                }
              />
            </span>
          ),
      },
    ],
    [t, remove, invalidate],
  );

  return (
    <>
      <PageHeader
        title={t('budgets.items.title')}
        description={t('budgets.items.subtitle')}
        actions={
          <Button onClick={() => setEditor({ open: true, item: null })}>
            <Plus /> {t('budgets.items.new')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        onRowClick={(row) => setEditor({ open: true, item: row })}
      />
      <BudgetItemDialog
        item={editor.item}
        nextSortOrder={((data?.length ?? 0) + 1) * 10}
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
      />
    </>
  );
}

function BudgetItemDialog({
  item,
  nextSortOrder,
  open,
  onOpenChange,
}: {
  item: BudgetItemDto | null;
  nextSortOrder: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <BudgetItemForm
          item={item}
          nextSortOrder={nextSortOrder}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function BudgetItemForm({
  item,
  nextSortOrder,
  onClose,
}: {
  item: BudgetItemDto | null;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateBudgets();
  const create = useBudgetItemsCreate();
  const update = useBudgetItemsUpdate();
  const { data: options } = useBudgetItemsOptions();
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState<BudgetItemKind>(item?.kind ?? 'EXPENSE');
  const [source, setSource] = useState<BudgetSource>(item?.source ?? 'MANUAL');
  const [categoryIds, setCategoryIds] = useState(item?.categories.map((c) => c.id) ?? []);
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? nextSortOrder));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [description, setDescription] = useState(item?.description ?? '');

  const changeSource = (value: BudgetSource) => {
    setSource(value);
    setCategoryIds([]);
    const fixed = SOURCE_KIND[value];
    if (fixed) setKind(fixed);
  };

  const categories =
    source === 'EXPENSES'
      ? (options?.expenseCategories ?? [])
      : source === 'PURCHASES'
        ? (options?.productCategories ?? [])
        : [];
  const order = Number(sortOrder);
  const valid =
    CODE_PATTERN.test(code.trim()) &&
    name.trim().length >= 2 &&
    Number.isInteger(order) &&
    order >= 0 &&
    order <= 999;

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate();
    onClose();
  };

  const submit = () => {
    const payload = {
      code: code.trim(),
      name: name.trim(),
      kind,
      source,
      categoryIds: hasCategories(source) ? categoryIds : [],
      sortOrder: order,
      isActive,
      description: emptyToNull(description.trim()),
    };
    if (item) update.mutate({ id: item.id, data: payload }, { onSuccess });
    else create.mutate({ data: payload }, { onSuccess });
  };

  const pending = create.isPending || update.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item ? item.name : t('budgets.items.new')}</DialogTitle>
        <DialogDescription>{t('budgets.items.hint')}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="item-code">{t('common.code')}</Label>
          <Input
            id="item-code"
            value={code}
            maxLength={20}
            aria-invalid={code !== '' && !CODE_PATTERN.test(code.trim())}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-name">{t('common.name')}</Label>
          <Input
            id="item-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('budgets.sourceLabel')}</Label>
          <Select value={source} onValueChange={(value) => changeSource(value as BudgetSource)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`budgets.source.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('budgets.kindLabel')}</Label>
          <Select
            value={kind}
            disabled={!!SOURCE_KIND[source]}
            onValueChange={(value) => setKind(value as BudgetItemKind)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`budgets.kind.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-xs sm:col-span-2">
          {t(`budgets.sourceHint.${source}`)}
        </p>
        {hasCategories(source) && (
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('budgets.items.categories')}</Label>
            <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={categoryIds.includes(c.id)}
                    onCheckedChange={(checked) =>
                      setCategoryIds((current) =>
                        checked ? [...current, c.id] : current.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{t('budgets.items.categoriesHint')}</p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="item-order">{t('budgets.items.sortOrder')}</Label>
          <Input
            id="item-order"
            type="number"
            min={0}
            max={999}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch id="item-active" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="item-active">{t('common.active')}</Label>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="item-description">{t('common.description')}</Label>
          <Textarea
            id="item-description"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!valid || pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          {t('common.save')}
        </Button>
      </DialogFooter>
    </>
  );
}
