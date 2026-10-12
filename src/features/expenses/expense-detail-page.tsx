import { Link, useNavigate } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  Loader2,
  Pencil,
  Send,
  Trash2,
  Undo2,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useExpenseReportsCancel,
  useExpenseReportsFindOne,
  useExpenseReportsPay,
  useExpenseReportsRemove,
  useExpenseReportsReversePayment,
  useExpenseReportsSubmit,
  useExpenseReportsWithdraw,
} from '@/api/generated/endpoints/expenses/expenses';
import {
  useWorkflowInstancesApprove,
  useWorkflowInstancesFindOne,
  useWorkflowInstancesReject,
} from '@/api/generated/endpoints/workflow/workflow';
import type { ExpenseLineDto, ExpenseReportDetailDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { AccountSelect, useAccountOptions } from '@/features/finance/finance-components';
import { CancelDocumentDialog, today } from '@/features/trade/trade-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
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
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Textarea } from '@/shared/ui/textarea';
import {
  ExpenseStatusBadge,
  ReceiptButton,
  isRated,
  useInvalidateExpenses,
} from './expense-components';

export function ExpenseDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const invalidate = useInvalidateExpenses();
  const { data: report, isLoading } = useExpenseReportsFindOne(id);
  const submit = useExpenseReportsSubmit();
  const withdraw = useExpenseReportsWithdraw();
  const cancel = useExpenseReportsCancel();
  const remove = useExpenseReportsRemove();
  const reverse = useExpenseReportsReversePayment();
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  if (!report) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const done = (message: string) => async () => {
    toast.success(message);
    await invalidate();
  };
  const busy =
    submit.isPending ||
    withdraw.isPending ||
    cancel.isPending ||
    remove.isPending ||
    reverse.isPending;
  const deletable = report.canEdit && report.status === 'DRAFT' && !report.submittedAt;
  const currency = report.currencyCode;

  return (
    <>
      <Link
        to={can('expenses:read') ? '/expenses' : '/expenses/my'}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {can('expenses:read') ? t('expenses.title') : t('expenses.myTitle')}
      </Link>
      <PageHeader
        title={report.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{report.number}</code>
            <ExpenseStatusBadge status={report.status} />
            <span>{report.employeeName}</span>
          </span>
        }
        actions={
          <>
            {report.canEdit && (
              <Button variant="outline" asChild>
                <Link to="/expenses/edit/$id" params={{ id }}>
                  <Pencil /> {t('common.edit')}
                </Link>
              </Button>
            )}
            {deletable && (
              <ConfirmDialog
                description={t('expenses.messages.deleteConfirm')}
                onConfirm={() =>
                  remove.mutate(
                    { id },
                    {
                      onSuccess: async () => {
                        toast.success(t('expenses.messages.deleted'));
                        await invalidate();
                        await navigate({ to: '/expenses/my' });
                      },
                    },
                  )
                }
                trigger={
                  <Button variant="outline" disabled={busy}>
                    <Trash2 /> {t('expenses.actions.delete')}
                  </Button>
                }
              />
            )}
            {report.canWithdraw && (
              <ConfirmDialog
                title={t('expenses.messages.withdrawTitle')}
                description={t('expenses.messages.withdrawConfirm')}
                confirmLabel={t('expenses.actions.withdraw')}
                onConfirm={() =>
                  withdraw.mutate({ id }, { onSuccess: done(t('expenses.messages.withdrawn')) })
                }
                trigger={
                  <Button variant="outline" disabled={busy}>
                    <Undo2 /> {t('expenses.actions.withdraw')}
                  </Button>
                }
              />
            )}
            {report.canCancel && (
              <Button variant="outline" disabled={busy} onClick={() => setCancelling(true)}>
                <Ban /> {t('expenses.actions.cancel')}
              </Button>
            )}
            {report.canReversePayment && (
              <ConfirmDialog
                title={t('expenses.messages.reverseTitle')}
                description={t('expenses.messages.reverseConfirm')}
                confirmLabel={t('expenses.actions.reversePayment')}
                onConfirm={() =>
                  reverse.mutate({ id }, { onSuccess: done(t('expenses.messages.reversed')) })
                }
                trigger={
                  <Button variant="outline" disabled={busy}>
                    <Undo2 /> {t('expenses.actions.reversePayment')}
                  </Button>
                }
              />
            )}
            {report.canSubmit && (
              <Button
                disabled={busy || report.missingReceiptCount > 0}
                onClick={() =>
                  submit.mutate(
                    { id },
                    {
                      onSuccess: done(t('expenses.messages.submitted', { number: report.number })),
                    },
                  )
                }
              >
                {submit.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                {t('expenses.actions.submit')}
              </Button>
            )}
            {report.canPay && (
              <Button onClick={() => setPaying(true)}>
                <Wallet /> {t('expenses.actions.pay')}
              </Button>
            )}
          </>
        }
      />

      <StatusNotes report={report} />

      {report.status === 'PENDING' && report.workflowInstanceId && (
        <ApprovalPanel instanceId={report.workflowInstanceId} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t('expenses.lines.title')} ({report.lines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LinesTable report={report} />
            <dl className="mt-3 flex flex-col items-end gap-1 text-sm">
              <div className="flex gap-3">
                <dt className="text-muted-foreground">{t('expenses.vatTotal')}</dt>
                <dd className="tabular-nums">{formatMoney(report.vatTotal, currency)}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-muted-foreground">{t('expenses.total')}</dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(report.totalAmount, currency)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={t('expenses.employee')}>{report.employeeName}</Field>
              <Field label={t('expenses.department')}>{report.departmentName}</Field>
              {report.projectId && (
                <Field label={t('expenses.project')}>
                  <Link
                    to="/projects/$id"
                    params={{ id: report.projectId }}
                    className="text-primary hover:underline"
                  >
                    {report.projectNumber} · {report.projectName}
                  </Link>
                </Field>
              )}
              <Field label={t('expenses.createdAt')}>{formatDate(report.createdAt)}</Field>
              <Field label={t('expenses.createdBy')}>{report.createdByName}</Field>
              <Field label={t('expenses.submittedAt')}>{formatDateTime(report.submittedAt)}</Field>
              <Field label={t('expenses.decidedAt')}>{formatDateTime(report.decidedAt)}</Field>
              {report.workflowInstanceId && can('workflow:read') && (
                <div className="col-span-2">
                  <Field label={t('expenses.approval')}>
                    <Link
                      to="/workflow/instances/$id"
                      params={{ id: report.workflowInstanceId }}
                      className="text-primary hover:underline"
                    >
                      {t('expenses.viewApproval')}
                    </Link>
                  </Field>
                </div>
              )}
              {report.paidAt && (
                <>
                  <Field label={t('expenses.paymentDate')}>{formatDate(report.paymentDate)}</Field>
                  <Field label={t('expenses.paidBy')}>{report.paidByName}</Field>
                  <div className="col-span-2">
                    <Field label={t('expenses.paymentAccount')}>
                      {report.paymentAccountId && can('finance:read') ? (
                        <Link
                          to="/finance/accounts/$id"
                          params={{ id: report.paymentAccountId }}
                          className="text-primary hover:underline"
                        >
                          {report.paymentAccountName}
                        </Link>
                      ) : (
                        report.paymentAccountName
                      )}
                    </Field>
                  </div>
                </>
              )}
              {report.description && (
                <div className="col-span-2">
                  <Field label={t('expenses.description')}>{report.description}</Field>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      <CancelDocumentDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t('expenses.messages.cancelTitle', { number: report.number })}
        pending={cancel.isPending}
        onConfirm={(reason) =>
          cancel.mutate(
            { id, data: { reason } },
            {
              onSuccess: async () => {
                setCancelling(false);
                await done(t('expenses.messages.cancelled'))();
              },
            },
          )
        }
      />
      <PayDialog report={report} open={paying} onOpenChange={setPaying} />
    </>
  );
}

function StatusNotes({ report }: { report: ExpenseReportDetailDto }) {
  const { t } = useTranslation();
  const notes: string[] = [];
  if (report.status === 'REJECTED') notes.push(t('expenses.messages.rejected'));
  if (report.missingReceiptCount > 0 && report.canSubmit) {
    notes.push(t('expenses.messages.missingReceipts', { count: report.missingReceiptCount }));
  }
  if (report.overLimitCount > 0 && ['PENDING', 'APPROVED'].includes(report.status)) {
    notes.push(t('expenses.messages.overLimit', { count: report.overLimitCount }));
  }
  if (notes.length === 0) return null;
  return (
    <div className="mb-4 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
      {notes.map((note) => (
        <p key={note} className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" /> {note}
        </p>
      ))}
    </div>
  );
}

function LinesTable({ report }: { report: ExpenseReportDetailDto }) {
  const { t } = useTranslation();
  const currency = report.currencyCode;
  const quantity = (line: ExpenseLineDto) =>
    line.categoryKind === 'MILEAGE'
      ? formatQuantity(line.quantity, 'km')
      : t('partners.days', { count: Number(line.quantity) });
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>{t('expenses.lines.date')}</TableHead>
            <TableHead>{t('expenses.lines.category')}</TableHead>
            <TableHead>{t('expenses.lines.description')}</TableHead>
            <TableHead className="text-right">{t('expenses.lines.amount')}</TableHead>
            <TableHead className="text-right">
              {t('expenses.lines.amountBase', { currency })}
            </TableHead>
            <TableHead>{t('expenses.lines.receipt')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell className="text-muted-foreground">{line.lineNo}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(line.expenseDate)}</TableCell>
              <TableCell>
                {line.categoryName}
                {line.overLimit && (
                  <span className="mt-1 block">
                    <ToneBadge tone="danger">{t('expenses.lines.overLimit')}</ToneBadge>
                  </span>
                )}
              </TableCell>
              <TableCell>
                {line.description}
                {line.merchant && (
                  <span className="text-muted-foreground block text-xs">{line.merchant}</span>
                )}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {isRated(line.categoryKind) ? (
                  quantity(line)
                ) : (
                  <>
                    {formatMoney(line.amount, line.currencyCode)}
                    {Number(line.vatAmount) > 0 && (
                      <span className="text-muted-foreground block text-xs">
                        {t('expenses.lines.vat')} {formatMoney(line.vatAmount, line.currencyCode)}
                      </span>
                    )}
                    {line.currencyCode !== currency && (
                      <span className="text-muted-foreground block text-xs">
                        {t('expenses.lines.rate')} {Number(line.exchangeRate)}
                      </span>
                    )}
                  </>
                )}
              </TableCell>
              <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                {formatMoney(line.amountBase, currency)}
              </TableCell>
              <TableCell>
                {line.receiptFileId ? (
                  <ReceiptButton reportId={report.id} lineId={line.id} name={line.receiptName} />
                ) : line.missingReceipt ? (
                  <ToneBadge tone="warning">{t('expenses.lines.missingReceipt')}</ToneBadge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Approve / reject right on the report for the current approver. */
function ApprovalPanel({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateExpenses();
  const { data: instance } = useWorkflowInstancesFindOne(instanceId);
  const approve = useWorkflowInstancesApprove();
  const reject = useWorkflowInstancesReject();
  const [comment, setComment] = useState('');
  if (!instance?.canAct) return null;

  const onDone = async () => {
    setComment('');
    toast.success(t('common.saved'));
    await invalidate();
  };
  const pending = approve.isPending || reject.isPending;

  return (
    <Card className="mb-4 border-amber-500/40">
      <CardHeader>
        <CardTitle className="text-base">
          {t('expenses.approval')} · {instance.currentStepName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder={t('common.comment')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() =>
              approve.mutate(
                { id: instanceId, data: { comment: comment || undefined } },
                { onSuccess: onDone },
              )
            }
          >
            {approve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            {t('workflow.approve')}
          </Button>
          <Button
            variant="destructive"
            disabled={pending || comment.trim().length < 2}
            title={t('workflow.rejectReason')}
            onClick={() =>
              reject.mutate({ id: instanceId, data: { comment } }, { onSuccess: onDone })
            }
          >
            <X /> {t('workflow.reject')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PayDialog({
  report,
  open,
  onOpenChange,
}: {
  report: ExpenseReportDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <PayForm report={report} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog content, so every opening starts from fresh values. */
function PayForm({ report, onClose }: { report: ExpenseReportDetailDto; onClose: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateExpenses();
  const pay = useExpenseReportsPay();
  const accounts = useAccountOptions({ currencyCode: report.currencyCode });
  const [picked, setPicked] = useState('');
  const [date, setDate] = useState(today());
  const accountId = picked || (accounts.length === 1 ? accounts[0].id : '');

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('expenses.pay.title')}</DialogTitle>
        <DialogDescription>
          {t('expenses.pay.description', {
            employee: report.employeeName,
            amount: formatMoney(report.totalAmount, report.currencyCode),
          })}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('expenses.pay.account')}</Label>
          <AccountSelect value={accountId} onChange={setPicked} accounts={accounts} />
          {accounts.length === 0 && (
            <p className="text-destructive text-xs">
              {t('expenses.pay.noAccount', { currency: report.currencyCode })}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-pay-date">{t('expenses.pay.date')}</Label>
          <Input
            id="expense-pay-date"
            type="date"
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button
          disabled={!accountId || !date || pay.isPending}
          onClick={() =>
            pay.mutate(
              { id: report.id, data: { accountId, paymentDate: date } },
              {
                onSuccess: async () => {
                  toast.success(t('expenses.messages.paid'));
                  onClose();
                  await invalidate();
                },
              },
            )
          }
        >
          {pay.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
          {t('expenses.actions.pay')}
        </Button>
      </DialogFooter>
    </>
  );
}
