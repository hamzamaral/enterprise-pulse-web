import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useBudgetsActuals,
  useBudgetsCreate,
  useBudgetsList,
  useBudgetsOptions,
  useBudgetsReopen,
  useBudgetsUpdate,
} from '@/api/generated/endpoints/budgets/budgets';
import type { BudgetBasis, BudgetDetailDto, BudgetRowDto } from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatDate, formatMoney } from '@/shared/lib/format';
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
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { Textarea } from '@/shared/ui/textarea';
import { budgetYears, DocumentLink, monthShort, useInvalidateBudgets } from './budget-components';

const COMPANY = '__company__';
const AUTO = '__auto__';
const ALL = '__all__';
const BASES: BudgetBasis[] = ['EMPTY', 'BUDGET', 'ACTUALS'];

/** New budget for a year and department, optionally prefilled from a budget or last year's actuals. */
export function CreateBudgetDialog({
  year,
  open,
  onOpenChange,
}: {
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <CreateBudgetForm initialYear={year} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateBudgetForm({ initialYear, onClose }: { initialYear: number; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateBudgets();
  const create = useBudgetsCreate();
  const [year, setYear] = useState(initialYear);
  const [departmentId, setDepartmentId] = useState(COMPANY);
  const [ownerId, setOwnerId] = useState(AUTO);
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<BudgetBasis>('EMPTY');
  const [sourceBudgetId, setSourceBudgetId] = useState('');
  const [adjustPercent, setAdjustPercent] = useState('0');
  const [note, setNote] = useState('');
  const { data: options } = useBudgetsOptions();
  const { data: previous } = useBudgetsList(
    { year: year - 1 },
    { query: { enabled: basis === 'BUDGET' } },
  );

  const percent = Number(adjustPercent.replace(',', '.'));
  const percentValid = Number.isFinite(percent) && percent >= -100 && percent <= 500;
  const valid =
    (name.trim() === '' || name.trim().length >= 3) &&
    percentValid &&
    (basis !== 'BUDGET' || !!sourceBudgetId);

  const submit = () =>
    create.mutate(
      {
        data: {
          year,
          departmentId: departmentId === COMPANY ? null : departmentId,
          ownerId: ownerId === AUTO ? undefined : ownerId,
          name: name.trim() || undefined,
          note: emptyToNull(note.trim()),
          basis,
          sourceBudgetId: basis === 'BUDGET' ? sourceBudgetId : undefined,
          adjustPercent: basis === 'EMPTY' ? undefined : percent,
        },
      },
      {
        onSuccess: async (budget) => {
          toast.success(t('budgets.created'));
          await invalidate();
          onClose();
          await navigate({ to: '/budgets/$id', params: { id: budget.id } });
        },
      },
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('budgets.new')}</DialogTitle>
        <DialogDescription>{t('budgets.createHint')}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('budgets.year')}</Label>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {budgetYears().map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('budgets.department')}</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={COMPANY}>{t('budgets.companyWide')}</SelectItem>
              {options?.departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget-name">{t('common.name')}</Label>
          <Input
            id="budget-name"
            value={name}
            placeholder={t('budgets.defaultName')}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('budgets.owner')}</Label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>{t('budgets.defaultOwner')}</SelectItem>
              {options?.owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('budgets.basisLabel')}</Label>
          <Select value={basis} onValueChange={(value) => setBasis(value as BudgetBasis)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`budgets.basis.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {basis !== 'EMPTY' && (
          <div className="space-y-2">
            <Label htmlFor="budget-adjust">{t('budgets.adjustPercent')}</Label>
            <Input
              id="budget-adjust"
              type="number"
              min={-100}
              max={500}
              value={adjustPercent}
              aria-invalid={!percentValid}
              onChange={(e) => setAdjustPercent(e.target.value)}
            />
          </div>
        )}
        {basis === 'BUDGET' && (
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('budgets.sourceBudget', { year: year - 1 })}</Label>
            <Select value={sourceBudgetId} onValueChange={setSourceBudgetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('common.select')} />
              </SelectTrigger>
              <SelectContent>
                {previous?.budgets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {previous && !previous.budgets.length && (
              <p className="text-muted-foreground text-xs">
                {t('budgets.noSourceBudget', { year: year - 1 })}
              </p>
            )}
          </div>
        )}
        {basis === 'ACTUALS' && (
          <p className="text-muted-foreground text-xs sm:col-span-2">
            {t('budgets.actualsBasisHint', { year: year - 1 })}
          </p>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="budget-note">{t('budgets.note')}</Label>
          <Textarea
            id="budget-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending && <Loader2 className="animate-spin" />}
          {t('common.create')}
        </Button>
      </DialogFooter>
    </>
  );
}

interface BudgetDialogProps {
  budget: BudgetDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const editSchema = z.object({
  name: z.string().trim().min(3, 'validation.required').max(150),
  ownerId: z.string(),
  note: z.string().max(1000),
});

export function EditBudgetDialog({ budget, open, onOpenChange }: BudgetDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateBudgets();
  const update = useBudgetsUpdate();
  const { data: options } = useBudgetsOptions({ query: { enabled: open } });
  return (
    <SimpleFormDialog<z.infer<typeof editSchema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t('budgets.editTitle')}
      schema={editSchema}
      pending={update.isPending}
      defaultValues={{
        name: budget.name,
        ownerId: budget.ownerId ?? '',
        note: budget.note ?? '',
      }}
      fields={[
        { name: 'name', label: t('common.name'), wide: true },
        {
          name: 'ownerId',
          label: t('budgets.owner'),
          type: 'select',
          wide: true,
          options: (options?.owners ?? []).map((o) => ({ value: o.id, label: o.name })),
        },
        { name: 'note', label: t('budgets.note'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        update.mutate(
          {
            id: budget.id,
            data: {
              name: values.name,
              ownerId: values.ownerId || null,
              note: emptyToNull(values.note.trim()),
            },
          },
          {
            onSuccess: async () => {
              toast.success(t('common.saved'));
              await invalidate();
              onOpenChange(false);
            },
          },
        )
      }
    />
  );
}

const reopenSchema = z.object({
  reason: z.string().trim().min(3, 'validation.required').max(500),
});

export function ReopenBudgetDialog({ budget, open, onOpenChange }: BudgetDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateBudgets();
  const reopen = useBudgetsReopen();
  return (
    <SimpleFormDialog<z.infer<typeof reopenSchema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t('budgets.reopenTitle')}
      description={<p className="text-muted-foreground text-sm">{t('budgets.reopenHint')}</p>}
      schema={reopenSchema}
      pending={reopen.isPending}
      defaultValues={{ reason: '' }}
      fields={[{ name: 'reason', label: t('budgets.reason'), type: 'textarea', wide: true }]}
      onSubmit={(values) =>
        reopen.mutate(
          { id: budget.id, data: values },
          {
            onSuccess: async () => {
              toast.success(t('budgets.reopened'));
              await invalidate();
              onOpenChange(false);
            },
          },
        )
      }
    />
  );
}

/** The documents and entries behind an item's actual amount. */
export function ActualsDialog({
  budget,
  row,
  onOpenChange,
}: {
  budget: BudgetDetailDto;
  row: BudgetRowDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {row && <ActualsBody key={row.itemId} budget={budget} row={row} />}
      </DialogContent>
    </Dialog>
  );
}

function ActualsBody({ budget, row }: { budget: BudgetDetailDto; row: BudgetRowDto }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(ALL);
  const { data, isLoading } = useBudgetsActuals(budget.id, {
    itemId: row.itemId,
    month: month === ALL ? undefined : Number(month),
  });

  const total = (data ?? []).reduce((sum, a) => sum + Number(a.amount), 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {row.code} · {row.name}
        </DialogTitle>
        <DialogDescription>
          {t(`budgets.source.${row.source}`)} · {t('budgets.actualsHint', { year: budget.year })}
        </DialogDescription>
      </DialogHeader>
      <Select value={month} onValueChange={setMonth}>
        <SelectTrigger className="w-40" aria-label={t('budgets.month')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('budgets.allMonths')}</SelectItem>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <SelectItem key={m} value={String(m)}>
              {formatDate(`${budget.year}-${String(m).padStart(2, '0')}-01`, 'MMMM')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="max-h-[55vh] overflow-y-auto">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !data?.length ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{t('budgets.noActuals')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('budgets.date')}</TableHead>
                <TableHead>{t('budgets.document')}</TableHead>
                <TableHead>{t('common.description')}</TableHead>
                <TableHead>{t('budgets.department')}</TableHead>
                <TableHead className="text-right">{t('budgets.amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a, index) => (
                <TableRow key={`${a.documentType}-${a.documentId}-${index}`}>
                  <TableCell className="whitespace-nowrap">{formatDate(a.date)}</TableCell>
                  <TableCell>
                    <DocumentLink type={a.documentType} id={a.documentId} reference={a.reference} />
                  </TableCell>
                  <TableCell className="max-w-72 truncate" title={a.description}>
                    {a.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.departmentName ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(a.amount, budget.currencyCode)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>
                  {t('budgets.actualsTotal', {
                    count: data.length,
                    month: month === ALL ? t('budgets.allMonths') : monthShort(Number(month)),
                  })}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(total, budget.currencyCode)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
    </>
  );
}
