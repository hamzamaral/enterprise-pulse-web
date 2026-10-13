import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  CheckCheck,
  Equal,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import {
  useBudgetItemsFindAll,
  useBudgetsApprove,
  useBudgetsFindOne,
  useBudgetsRemove,
  useBudgetsSavePlan,
} from '@/api/generated/endpoints/budgets/budgets';
import type {
  BudgetDetailDto,
  BudgetEventDto,
  BudgetItemKind,
  BudgetRowDto,
  BudgetTotalsDto,
} from '@/api/generated/model';
import { CHART_COLORS, compactNumber, KpiCard } from '@/features/reports/report-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime, formatMoney, formatRelative } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  BudgetStateBadge,
  BudgetStatusBadge,
  formatPercent,
  monthShort,
  UsageBar,
  useInvalidateBudgets,
} from './budget-components';
import { ActualsDialog, EditBudgetDialog, ReopenBudgetDialog } from './budget-dialogs';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const KINDS: BudgetItemKind[] = ['INCOME', 'EXPENSE'];

type DialogKind = 'edit' | 'reopen';

export function BudgetPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateBudgets();
  const { data: budget, isLoading } = useBudgetsFindOne(id);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [drill, setDrill] = useState<BudgetRowDto | null>(null);
  const approve = useBudgetsApprove();
  const remove = useBudgetsRemove();

  if (!budget) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const dialogProps = (kind: DialogKind) => ({
    budget,
    open: dialog === kind,
    onOpenChange: (open: boolean) => setDialog(open ? kind : null),
  });
  const money = (value: string | number) => formatMoney(value, budget.currencyCode);
  const hasPlan = budget.rows.some((r) => Number(r.plannedTotal) > 0);

  return (
    <>
      <Link
        to="/budgets"
        search={{ year: budget.year }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('budgets.title')}
      </Link>
      <PageHeader
        title={budget.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <BudgetStatusBadge status={budget.status} />
            <span className="text-muted-foreground text-sm">
              {budget.year} · {budget.departmentName ?? t('budgets.companyWide')}
              {budget.revision > 0 &&
                ` · ${t('budgets.revisionShort', { revision: budget.revision })}`}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {budget.canApprove && (
              <ConfirmDialog
                trigger={
                  <Button disabled={approve.isPending || !hasPlan}>
                    <CheckCheck /> {t('budgets.approve')}
                  </Button>
                }
                title={t('budgets.approveTitle')}
                description={t('budgets.approveHint')}
                confirmLabel={t('budgets.approve')}
                onConfirm={() =>
                  approve.mutate(
                    { id },
                    {
                      onSuccess: async () => {
                        toast.success(t('budgets.approved'));
                        await invalidate();
                      },
                    },
                  )
                }
              />
            )}
            {budget.canReopen && (
              <Button variant="outline" onClick={() => setDialog('reopen')}>
                <Undo2 /> {t('budgets.reopen')}
              </Button>
            )}
            {budget.canUpdate && (
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            {budget.canDelete && (
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
                        toast.success(t('budgets.deleted'));
                        await navigate({ to: '/budgets', search: { year: budget.year } });
                        await invalidate();
                      },
                    },
                  )
                }
              />
            )}
          </div>
        }
      />

      {budget.status === 'DRAFT' && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          {t('budgets.draftNotice')}
        </div>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('budgets.kpi.expensePlanned')}
          value={money(budget.expense.plannedTotal)}
          hint={t('budgets.kpi.ytdPlan', { value: money(budget.expense.plannedYtd) })}
        />
        <KpiCard
          label={t('budgets.kpi.expenseActual')}
          value={money(budget.expense.actualYtd)}
          tone={
            budget.expense.utilization !== null && budget.expense.utilization > 100
              ? 'negative'
              : undefined
          }
          hint={t('budgets.kpi.usage', { percent: formatPercent(budget.expense.utilization) })}
        />
        {Number(budget.income.plannedTotal) || Number(budget.income.actualTotal) ? (
          <KpiCard
            label={t('budgets.kpi.incomeActual')}
            value={money(budget.income.actualYtd)}
            tone={
              Number(budget.income.actualYtd) >= Number(budget.income.plannedYtd)
                ? 'positive'
                : undefined
            }
            hint={t('budgets.kpi.ofPlan', {
              plan: money(budget.income.plannedYtd),
              percent: formatPercent(budget.income.utilization),
            })}
          />
        ) : (
          <KpiCard
            label={t('budgets.kpi.remaining')}
            value={money(Number(budget.expense.plannedTotal) - Number(budget.expense.actualTotal))}
            tone={
              Number(budget.expense.actualTotal) > Number(budget.expense.plannedTotal)
                ? 'negative'
                : undefined
            }
            hint={t('budgets.kpi.remainingHint')}
          />
        )}
        <KpiCard
          label={t('budgets.kpi.over')}
          value={budget.overCount}
          tone={budget.overCount > 0 ? 'negative' : undefined}
          hint={t('budgets.kpi.overHint', {
            warning: budget.warningCount,
            behind: budget.behindCount,
          })}
        />
      </div>

      <Tabs defaultValue="comparison" className="mb-4">
        <TabsList>
          <TabsTrigger value="comparison">{t('budgets.tabs.comparison')}</TabsTrigger>
          <TabsTrigger value="plan">{t('budgets.tabs.plan')}</TabsTrigger>
        </TabsList>
        <TabsContent value="comparison" className="space-y-4">
          <MonthlyChart budget={budget} />
          <ComparisonTable budget={budget} onOpen={setDrill} />
        </TabsContent>
        <TabsContent value="plan">
          <PlanEditor key={`${budget.id}-${budget.events.length}`} budget={budget} />
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailsCard budget={budget} />
        <HistoryCard events={budget.events} />
      </div>

      <EditBudgetDialog {...dialogProps('edit')} />
      <ReopenBudgetDialog {...dialogProps('reopen')} />
      <ActualsDialog budget={budget} row={drill} onOpenChange={(open) => !open && setDrill(null)} />
    </>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};

/** Monthly expense plan and actual, with the cumulative actual against the cumulative plan. */
function MonthlyChart({ budget }: { budget: BudgetDetailDto }) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    const upTo = (values: string[], month: number) =>
      values.slice(0, month).reduce((sum, v) => sum + Number(v), 0);
    return MONTHS.map((month, i) => {
      const past = month <= budget.elapsedMonths;
      return {
        label: monthShort(month),
        planned: Number(budget.expense.planned[i]),
        actual: past ? Number(budget.expense.actual[i]) : null,
        plannedSum: upTo(budget.expense.planned, month),
        actualSum: past ? upTo(budget.expense.actual, month) : null,
      };
    });
  }, [budget]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('budgets.monthlyExpense')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              yAxisId="month"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={56}
              tickFormatter={compactNumber}
            />
            <YAxis
              yAxisId="sum"
              orientation="right"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={56}
              tickFormatter={compactNumber}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
              formatter={(value) => formatMoney(Number(value), budget.currencyCode)}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="month"
              dataKey="planned"
              name={t('budgets.planned')}
              fill={CHART_COLORS.muted}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Bar
              yAxisId="month"
              dataKey="actual"
              name={t('budgets.actual')}
              fill={CHART_COLORS.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Line
              yAxisId="sum"
              dataKey="plannedSum"
              name={t('budgets.cumulativePlan')}
              stroke={CHART_COLORS.muted}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              yAxisId="sum"
              dataKey="actualSum"
              name={t('budgets.cumulativeActual')}
              stroke={CHART_COLORS.secondary}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** Year-to-date plan against actual per item; a row opens the documents behind it. */
function ComparisonTable({
  budget,
  onOpen,
}: {
  budget: BudgetDetailDto;
  onOpen: (row: BudgetRowDto) => void;
}) {
  const { t } = useTranslation();
  const money = (value: string | number) => formatMoney(value, budget.currencyCode);
  const totals: Record<BudgetItemKind, BudgetTotalsDto> = {
    INCOME: budget.income,
    EXPENSE: budget.expense,
  };

  const varianceCell = (kind: BudgetItemKind, plannedYtd: string, actualYtd: string) => {
    const variance = Number(actualYtd) - Number(plannedYtd);
    const bad = kind === 'EXPENSE' ? variance > 0 : variance < 0;
    return (
      <span className={cn('tabular-nums', variance !== 0 && bad && 'text-destructive')}>
        {variance > 0 ? '+' : ''}
        {money(variance)}
      </span>
    );
  };

  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        {!budget.rows.length ? (
          <p className="text-muted-foreground text-sm">{t('budgets.noRows')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('budgets.item')}</TableHead>
                <TableHead className="text-right">{t('budgets.plannedTotal')}</TableHead>
                <TableHead className="text-right">{t('budgets.plannedYtd')}</TableHead>
                <TableHead className="text-right">{t('budgets.actualYtd')}</TableHead>
                <TableHead className="text-right">{t('budgets.variance')}</TableHead>
                <TableHead className="w-44">{t('budgets.usage')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
              </TableRow>
            </TableHeader>
            {KINDS.map((kind) => {
              const rows = budget.rows.filter((r) => r.kind === kind);
              if (!rows.length) return null;
              const total = totals[kind];
              return (
                <Fragment key={kind}>
                  <TableBody>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={7} className="text-xs font-semibold uppercase">
                        {t(`budgets.kind.${kind}`)}
                      </TableCell>
                    </TableRow>
                    {rows.map((row) => (
                      <TableRow
                        key={row.itemId}
                        className="cursor-pointer"
                        onClick={() => onOpen(row)}
                      >
                        <TableCell>
                          <span className="font-medium">
                            <code className="text-muted-foreground mr-1 text-xs">{row.code}</code>
                            {row.name}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {t(`budgets.source.${row.source}`)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.plannedTotal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.plannedYtd)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.actualYtd)}
                        </TableCell>
                        <TableCell className="text-right">
                          {varianceCell(kind, row.plannedYtd, row.actualYtd)}
                        </TableCell>
                        <TableCell>
                          <UsageBar value={row.utilization} income={kind === 'INCOME'} />
                        </TableCell>
                        <TableCell>
                          <BudgetStateBadge state={row.state} />
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 hover:bg-muted/50 font-medium">
                      <TableCell>{t(`budgets.total.${kind}`)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(total.plannedTotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(total.plannedYtd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(total.actualYtd)}
                      </TableCell>
                      <TableCell className="text-right">
                        {varianceCell(kind, total.plannedYtd, total.actualYtd)}
                      </TableCell>
                      <TableCell>
                        <UsageBar value={total.utilization} income={kind === 'INCOME'} />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Fragment>
              );
            })}
          </Table>
        )}
        <p className="text-muted-foreground mt-3 text-xs">{t('budgets.drillHint')}</p>
      </CardContent>
    </Card>
  );
}

interface PlanLine {
  itemId: string;
  code: string;
  name: string;
  kind: BudgetItemKind;
  amounts: string[];
}

const toAmount = (value: string) => Number(value.replace(',', '.'));
const validAmount = (value: string) =>
  value.trim() === '' || (Number.isFinite(toAmount(value)) && toAmount(value) >= 0);

/** Monthly plan grid; editable while the budget is a draft. */
function PlanEditor({ budget }: { budget: BudgetDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateBudgets();
  const save = useBudgetsSavePlan();
  const editable = budget.canEdit;
  const { data: items } = useBudgetItemsFindAll({ query: { enabled: editable } });
  const initial = useMemo<PlanLine[]>(
    () =>
      budget.rows
        .filter((r) => Number(r.plannedTotal) > 0)
        .map((r) => ({
          itemId: r.itemId,
          code: r.code,
          name: r.name,
          kind: r.kind,
          amounts: r.planned.map((v) => String(Number(v))),
        })),
    [budget.rows],
  );
  const [lines, setLines] = useState(initial);
  const money = (value: number) => formatMoney(value, budget.currencyCode);

  const dirty = JSON.stringify(lines) !== JSON.stringify(initial);
  const valid = lines.every((l) => l.amounts.every(validAmount));
  const available = (items ?? []).filter(
    (item) => item.isActive && !lines.some((l) => l.itemId === item.id),
  );

  const setAmount = (itemId: string, month: number, value: string) =>
    setLines((current) =>
      current.map((l) =>
        l.itemId === itemId
          ? { ...l, amounts: l.amounts.map((v, i) => (i === month ? value : v)) }
          : l,
      ),
    );

  const spread = (itemId: string) =>
    setLines((current) =>
      current.map((l) => {
        if (l.itemId !== itemId) return l;
        const total = l.amounts.reduce((sum, v) => sum + (toAmount(v) || 0), 0);
        const monthly = Math.floor(total / 12);
        return {
          ...l,
          amounts: MONTHS.map((m) => String(m === 12 ? total - monthly * 11 : monthly)),
        };
      }),
    );

  const addItem = (itemId: string) => {
    const item = items?.find((i) => i.id === itemId);
    if (!item) return;
    setLines((current) => [
      ...current,
      {
        itemId: item.id,
        code: item.code,
        name: item.name,
        kind: item.kind,
        amounts: MONTHS.map(() => '0'),
      },
    ]);
  };

  const submit = () =>
    save.mutate(
      {
        id: budget.id,
        data: {
          lines: lines.map((l) => ({
            itemId: l.itemId,
            amounts: l.amounts.map((v) => toAmount(v) || 0),
          })),
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('budgets.planSaved'));
          await invalidate();
        },
      },
    );

  const lineTotal = (l: PlanLine) => l.amounts.reduce((sum, v) => sum + (toAmount(v) || 0), 0);
  const monthTotal = (kind: BudgetItemKind, index: number) =>
    lines
      .filter((l) => l.kind === kind)
      .reduce((sum, l) => sum + (toAmount(l.amounts[index] ?? '0') || 0), 0);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {!editable && (
          <p className="text-muted-foreground text-sm">
            {budget.canReopen ? t('budgets.planLockedReopen') : t('budgets.planLocked')}
          </p>
        )}
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">{t('budgets.item')}</TableHead>
                {MONTHS.map((m) => (
                  <TableHead key={m} className="text-right">
                    {monthShort(m)}
                  </TableHead>
                ))}
                <TableHead className="text-right">{t('budgets.yearTotal')}</TableHead>
                {editable && <TableHead />}
              </TableRow>
            </TableHeader>
            {KINDS.map((kind) => {
              const kindLines = lines.filter((l) => l.kind === kind);
              if (!kindLines.length) return null;
              return (
                <Fragment key={kind}>
                  <TableBody>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell
                        colSpan={editable ? 15 : 14}
                        className="text-xs font-semibold uppercase"
                      >
                        {t(`budgets.kind.${kind}`)}
                      </TableCell>
                    </TableRow>
                    {kindLines.map((line) => (
                      <TableRow key={line.itemId}>
                        <TableCell>
                          <code className="text-muted-foreground mr-1 text-xs">{line.code}</code>
                          {line.name}
                        </TableCell>
                        {line.amounts.map((value, i) => (
                          <TableCell key={i} className="px-1 text-right tabular-nums">
                            {editable ? (
                              <Input
                                type="number"
                                min={0}
                                inputMode="decimal"
                                className="h-8 w-24 px-2 text-right"
                                aria-label={`${line.name} ${monthShort(i + 1)}`}
                                aria-invalid={!validAmount(value)}
                                value={value}
                                onChange={(e) => setAmount(line.itemId, i, e.target.value)}
                              />
                            ) : (
                              compactNumber(toAmount(value) || 0)
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium tabular-nums">
                          {money(lineTotal(line))}
                        </TableCell>
                        {editable && (
                          <TableCell className="px-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title={t('budgets.spread')}
                              aria-label={t('budgets.spread')}
                              onClick={() => spread(line.itemId)}
                            >
                              <Equal />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title={t('common.remove')}
                              aria-label={t('common.remove')}
                              onClick={() =>
                                setLines((current) =>
                                  current.filter((l) => l.itemId !== line.itemId),
                                )
                              }
                            >
                              <X />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 hover:bg-muted/50 font-medium">
                      <TableCell>{t(`budgets.total.${kind}`)}</TableCell>
                      {MONTHS.map((m, i) => (
                        <TableCell key={m} className="px-1 text-right tabular-nums">
                          {compactNumber(monthTotal(kind, i))}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">
                        {money(kindLines.reduce((sum, l) => sum + lineTotal(l), 0))}
                      </TableCell>
                      {editable && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Fragment>
              );
            })}
          </Table>
        </div>
        {!lines.length && <p className="text-muted-foreground text-sm">{t('budgets.noPlan')}</p>}
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value="" onValueChange={addItem}>
              <SelectTrigger className="w-72" aria-label={t('budgets.addItem')}>
                <Plus className="size-4" />
                <SelectValue placeholder={t('budgets.addItem')} />
              </SelectTrigger>
              <SelectContent>
                {available.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              {dirty && (
                <Button variant="outline" onClick={() => setLines(initial)}>
                  <RotateCcw /> {t('budgets.resetPlan')}
                </Button>
              )}
              <Button disabled={!dirty || !valid || save.isPending} onClick={submit}>
                {save.isPending && <Loader2 className="animate-spin" />}
                {t('budgets.savePlan')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailsCard({ budget }: { budget: BudgetDetailDto }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('common.details')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label={t('budgets.department')}>
            {budget.departmentName ?? t('budgets.companyWide')}
          </Field>
          <Field label={t('budgets.owner')}>{budget.ownerName ?? '—'}</Field>
          <Field label={t('budgets.revision')}>
            {budget.revision > 0
              ? t('budgets.revisionShort', { revision: budget.revision })
              : t('budgets.original')}
          </Field>
          <Field label={t('budgets.approvedBy')}>
            {budget.approvedByName ? (
              <>
                {budget.approvedByName}
                <span className="text-muted-foreground block text-xs">
                  {formatDate(budget.approvedAt)}
                </span>
              </>
            ) : (
              '—'
            )}
          </Field>
          {budget.note && (
            <div className="sm:col-span-2">
              <Field label={t('budgets.note')}>
                <span className="whitespace-pre-line">{budget.note}</span>
              </Field>
            </div>
          )}
          <div className="text-muted-foreground text-xs sm:col-span-2">
            {t('budgets.createdBy', { name: budget.createdByName })}
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function HistoryCard({ events }: { events: BudgetEventDto[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('budgets.history')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="max-h-80 space-y-3 overflow-y-auto">
          {[...events].reverse().map((event) => (
            <li key={event.id} className="border-l-2 pl-3 text-sm">
              {t(`budgets.events.${event.type}`, {
                actor: event.actorName ?? t('budgets.system'),
              })}
              {event.note && (
                <span className="text-muted-foreground block text-xs">“{event.note}”</span>
              )}
              <span
                className="text-muted-foreground block text-xs"
                title={formatDateTime(event.createdAt)}
              >
                {formatRelative(event.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
