import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auditFindAll, useAuditFindAll } from '@/api/generated/endpoints/audit/audit';
import type { AuditLogDto } from '@/api/generated/model';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatDateTime } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN'] as const;
const ACTION_TONES: Record<string, Tone> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  LOGIN: 'neutral',
};
const ALL = 'all';

const display = (value: unknown) =>
  value === undefined || value === null
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

function AuditDetail({ log, onClose }: { log: AuditLogDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const oldValues = (log?.oldValues ?? {}) as Record<string, unknown>;
  const newValues = (log?.newValues ?? {}) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])];

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {log && t(`audit.actions.${log.action}` as never, { defaultValue: log.action })} ·{' '}
            {log?.entityType}
          </DialogTitle>
          <DialogDescription>
            {log?.userEmail ?? '—'} · {formatDateTime(log?.createdAt)} · {log?.ip}
          </DialogDescription>
        </DialogHeader>
        <div className="text-muted-foreground text-xs">
          {t('audit.entityId')}: <code>{log?.entityId ?? '—'}</code>
        </div>
        {fields.length > 0 ? (
          <div className="max-h-[50vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('audit.field')}</TableHead>
                  <TableHead>{t('audit.oldValue')}</TableHead>
                  <TableHead>{t('audit.newValue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field}>
                    <TableCell className="font-mono text-xs">{field}</TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-red-600 dark:text-red-400">
                      {display(oldValues[field])}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-emerald-700 dark:text-emerald-400">
                      {display(newValues[field])}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t('common.noResults')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AuditLogsPage() {
  const { t } = useTranslation();
  const table = useTableState();
  const [action, setAction] = useState<string>(ALL);
  const [selected, setSelected] = useState<AuditLogDto | null>(null);

  const params = { ...table.params, action: action === ALL ? undefined : action };
  const { data, isLoading } = useAuditFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<AuditLogDto, unknown>[]>(
    () => [
      {
        id: 'createdAt',
        header: t('audit.date'),
        enableSorting: false,
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        id: 'action',
        header: t('audit.action'),
        enableSorting: false,
        cell: ({ row }) => (
          <ToneBadge tone={ACTION_TONES[row.original.action] ?? 'neutral'}>
            {t(`audit.actions.${row.original.action}` as never, {
              defaultValue: row.original.action,
            })}
          </ToneBadge>
        ),
      },
      {
        id: 'entityType',
        header: t('audit.entity'),
        enableSorting: false,
        cell: ({ row }) => row.original.entityType,
      },
      {
        id: 'entityId',
        header: t('audit.entityId'),
        enableSorting: false,
        cell: ({ row }) => (
          <code className="text-muted-foreground text-xs">
            {row.original.entityId?.slice(0, 8) ?? '—'}
          </code>
        ),
      },
      {
        id: 'userEmail',
        header: t('audit.user'),
        enableSorting: false,
        cell: ({ row }) => row.original.userEmail ?? '—',
      },
      {
        id: 'ip',
        header: t('audit.ip'),
        enableSorting: false,
        cell: ({ row }) => row.original.ip ?? '—',
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader title={t('audit.title')} description={t('audit.subtitle')} />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onRowClick={setSelected}
        onExport={async () =>
          exportToExcel(
            'audit-log',
            [
              { header: t('audit.date'), value: (l) => new Date(l.createdAt) },
              { header: t('audit.action'), value: (l) => l.action },
              { header: t('audit.entity'), value: (l) => l.entityType },
              { header: t('audit.entityId'), value: (l) => l.entityId },
              { header: t('audit.user'), value: (l) => l.userEmail },
              { header: t('audit.ip'), value: (l) => l.ip },
            ],
            await fetchAllPages((page) => auditFindAll({ ...params, page, pageSize: 100 })),
          )
        }
        toolbar={
          <Select
            value={action}
            onValueChange={(value) => {
              setAction(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('common.all')}</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {t(`audit.actions.${a}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <AuditDetail log={selected} onClose={() => setSelected(null)} />
    </>
  );
}
