import { Link, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, CalendarX2, Check, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useJournalEntriesFindOne,
  useJournalEntriesPost,
  useJournalEntriesRemove,
  useJournalEntriesReverse,
} from '@/api/generated/endpoints/accounting/accounting';
import { useBaseCurrency, today } from '@/features/trade/trade-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field, InfoCard } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
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
import {
  AmountCell,
  JournalStatusBadge,
  SourceDocumentLink,
  useInvalidateAccounting,
} from './accounting-components';

const reverseSchema = z.object({
  date: z.string().min(1, 'validation.required'),
  note: z.string().max(300),
});

export function JournalEntryPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currency = useBaseCurrency();
  const { data: entry, isLoading } = useJournalEntriesFindOne(id);
  const invalidate = useInvalidateAccounting();
  const post = useJournalEntriesPost();
  const reverse = useJournalEntriesReverse();
  const remove = useJournalEntriesRemove();
  const [reverseOpen, setReverseOpen] = useState(false);

  if (!entry) {
    if (!isLoading) return <RecordNotFound />;
    return <Skeleton className="h-96" />;
  }

  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;

  const postNow = () =>
    post.mutate(
      { id: entry.id },
      {
        onSuccess: async () => {
          toast.success(t('accounting.journal.posted', { number: entry.number }));
          await invalidate();
        },
      },
    );

  const deleteNow = () =>
    remove.mutate(
      { id: entry.id },
      {
        onSuccess: async () => {
          toast.success(t('accounting.journal.deleted', { number: entry.number }));
          await invalidate();
          await navigate({ to: '/accounting/journal' });
        },
      },
    );

  return (
    <>
      <Link
        to="/accounting/journal"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('accounting.journal.title')}
      </Link>
      <PageHeader
        title={t('accounting.journal.entryTitle', { number: entry.number })}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <JournalStatusBadge
              status={entry.status}
              reversed={entry.isReversed}
              reversal={entry.isReversal}
            />
            {entry.locked && (
              <ToneBadge tone="neutral">
                <CalendarX2 className="size-3" /> {t('accounting.lockedPeriod')}
              </ToneBadge>
            )}
            <span>{entry.description}</span>
          </span>
        }
        actions={
          <>
            {entry.canEdit && (
              <Button variant="outline" asChild>
                <Link to="/accounting/journal/edit/$id" params={{ id: entry.id }}>
                  <Pencil /> {t('common.edit')}
                </Link>
              </Button>
            )}
            {entry.canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={remove.isPending}>
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                description={t('accounting.journal.deleteHint')}
                onConfirm={deleteNow}
              />
            )}
            {entry.canReverse && (
              <Button variant="outline" onClick={() => setReverseOpen(true)}>
                <Undo2 /> {t('accounting.journal.reverse')}
              </Button>
            )}
            {entry.canPost && (
              <Button onClick={postNow} disabled={post.isPending}>
                <Check /> {t('accounting.journal.post')}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4">
        <InfoCard title={t('common.details')}>
          <Field label={t('accounting.date')}>{formatDate(entry.entryDate)}</Field>
          <Field label={t('accounting.sourceLabel')}>
            <span className="flex flex-wrap items-center gap-2">
              {t(`accounting.source.${entry.source}`)}
              <SourceDocumentLink
                source={entry.source}
                documentId={entry.documentId}
                number={entry.sourceNumber}
              />
            </span>
          </Field>
          <Field label={t('common.createdBy')}>{entry.createdByName}</Field>
          <Field label={t('accounting.journal.postedAt')}>
            {entry.postedAt && formatDateTime(entry.postedAt)}
          </Field>
          {entry.reverses && (
            <Field label={t('accounting.journal.reverses')}>
              <Link
                to="/accounting/journal/$id"
                params={{ id: entry.reverses.id }}
                className="font-mono hover:underline"
              >
                {entry.reverses.number}
              </Link>
            </Field>
          )}
          {entry.reversal && (
            <Field label={t('accounting.journal.reversedBy')}>
              <Link
                to="/accounting/journal/$id"
                params={{ id: entry.reversal.id }}
                className="font-mono hover:underline"
              >
                {entry.reversal.number}
              </Link>
            </Field>
          )}
        </InfoCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('accounting.journal.lines')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t('accounting.account')}</TableHead>
                <TableHead>{t('accounting.journal.party')}</TableHead>
                <TableHead>{t('accounting.description')}</TableHead>
                <TableHead className="text-right">{t('accounting.debit')}</TableHead>
                <TableHead className="text-right">{t('accounting.credit')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {line.lineNo}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/accounting/accounts/$id"
                      params={{ id: line.accountId }}
                      className="hover:underline"
                    >
                      <span className="font-mono text-sm">{line.accountCode}</span>{' '}
                      <span className="text-sm">{line.accountName}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {line.partnerName ?? line.employeeName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {line.description ?? ''}
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountCell value={line.debit} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountCell value={line.credit} currency={currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">
                  {t('accounting.total')}
                </TableCell>
                <TableCell className="text-right">
                  <AmountCell value={totalDebit} currency={currency} strong />
                </TableCell>
                <TableCell className="text-right">
                  <AmountCell value={totalCredit} currency={currency} strong />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {difference !== 0 && (
            <p className="text-destructive mt-3 flex items-center gap-1 text-sm">
              <AlertTriangle className="size-4" />
              {t('accounting.journal.unbalanced', {
                value: formatMoney(Math.abs(difference), currency),
              })}
            </p>
          )}
        </CardContent>
      </Card>

      <SimpleFormDialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        title={t('accounting.journal.reverseTitle', { number: entry.number })}
        description={
          <p className="text-muted-foreground text-sm">{t('accounting.journal.reverseHint')}</p>
        }
        schema={reverseSchema}
        fields={[
          { name: 'date', label: t('accounting.date'), type: 'date' },
          { name: 'note', label: t('accounting.journal.reverseNote'), wide: true },
        ]}
        defaultValues={{ date: today(), note: '' }}
        pending={reverse.isPending}
        onSubmit={(values) =>
          reverse.mutate(
            { id: entry.id, data: { date: values.date, note: values.note.trim() || undefined } },
            {
              onSuccess: async (reversal) => {
                toast.success(t('accounting.journal.reversed', { number: reversal.number }));
                setReverseOpen(false);
                await invalidate();
                await navigate({ to: '/accounting/journal/$id', params: { id: reversal.id } });
              },
            },
          )
        }
      />
    </>
  );
}
