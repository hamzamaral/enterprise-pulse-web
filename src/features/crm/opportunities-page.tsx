import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Columns3, List, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  opportunitiesFindAll,
  useCrmSummary,
  useOpportunitiesBoard,
  useOpportunitiesFindAll,
} from '@/api/generated/endpoints/crm/crm';
import type { OpportunityDto, OpportunityStage } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { ALL_STAGES, ProbabilityBar, StageBadge } from './crm-components';
import { OpportunityFormDialog } from './opportunity-form-dialog';
import { PipelineBoard } from './pipeline-board';

export type OpportunityView = 'board' | 'list';

const ALL = 'ALL';
const OPEN = 'OPEN';
const CLOSED = 'CLOSED';

export function OpportunitiesPage({
  view,
  onViewChange,
}: {
  view: OpportunityView;
  onViewChange: (view: OpportunityView) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const summary = useCrmSummary();
  const s = summary.data;

  return (
    <>
      <PageHeader
        title={t('crm.opportunities.title')}
        description={t('crm.opportunities.subtitle')}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border p-0.5">
              {(['board', 'list'] as const).map((value) => {
                const Icon = value === 'board' ? Columns3 : List;
                return (
                  <Button
                    key={value}
                    size="sm"
                    variant="ghost"
                    className={cn('h-8', view === value && 'bg-muted')}
                    aria-pressed={view === value}
                    onClick={() => onViewChange(value)}
                  >
                    <Icon /> {t(`crm.opportunities.${value}`)}
                  </Button>
                );
              })}
            </div>
            <Can permission="crm:create">
              <Button onClick={() => setCreating(true)}>
                <Plus /> {t('crm.opportunities.new')}
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('dashboard.pipeline')}
          value={s && formatMoney(s.pipelineAmount, s.currencyCode)}
          hint={t('crm.opportunities.count', { count: s?.openCount ?? 0 })}
        />
        <KpiCard
          label={t('crm.opportunities.weighted')}
          value={s && formatMoney(s.weightedAmount, s.currencyCode)}
        />
        <KpiCard
          label={t('dashboard.wonThisMonth')}
          value={s && formatMoney(s.wonAmountThisMonth, s.currencyCode)}
          hint={s && t('dashboard.wonHint', { won: s.wonThisMonth, lost: s.lostThisMonth })}
          tone="positive"
        />
        <KpiCard
          label={t('dashboard.winRate')}
          value={s && (s.winRate === null ? '—' : `%${s.winRate}`)}
          hint={s && t('dashboard.winRateHint', { count: s.newLeads })}
        />
      </div>
      {s && s.unconvertedCurrencies.length > 0 && (
        <p className="text-muted-foreground mb-4 text-xs">
          {t('crm.unconverted', { codes: s.unconvertedCurrencies.join(', ') })}
        </p>
      )}

      {view === 'board' ? (
        <BoardView mine={mine} onMineChange={setMine} />
      ) : (
        <ListView
          mine={mine}
          onMineChange={setMine}
          onOpen={(id) => void navigate({ to: '/crm/opportunities/$id', params: { id } })}
        />
      )}

      <OpportunityFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(o) => void navigate({ to: '/crm/opportunities/$id', params: { id: o.id } })}
      />
    </>
  );
}

function MineSwitch({ mine, onChange }: { mine: boolean; onChange: (mine: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <Switch id="opportunities-mine" checked={mine} onCheckedChange={onChange} />
      <Label htmlFor="opportunities-mine">{t('crm.mine')}</Label>
    </div>
  );
}

function BoardView({ mine, onMineChange }: { mine: boolean; onMineChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const { data } = useOpportunitiesBoard({
    search: debounced.trim() || undefined,
    mine: mine ? 'true' : undefined,
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="pl-8"
          />
        </div>
        <MineSwitch mine={mine} onChange={onMineChange} />
        <p className="text-muted-foreground text-xs">{t('crm.opportunities.boardHint')}</p>
      </div>
      <PipelineBoard board={data} />
    </div>
  );
}

function ListView({
  mine,
  onMineChange,
  onOpen,
}: {
  mine: boolean;
  onMineChange: (v: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const table = useTableState({ sort: [{ id: 'expectedCloseDate', desc: false }] });
  const [stage, setStage] = useState(OPEN);

  const params = {
    ...table.params,
    stage: [ALL, OPEN, CLOSED].includes(stage) ? undefined : (stage as OpportunityStage),
    open: stage === OPEN ? ('true' as const) : stage === CLOSED ? ('false' as const) : undefined,
    mine: mine ? ('true' as const) : undefined,
  };
  const { data, isLoading } = useOpportunitiesFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<OpportunityDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'title',
        header: t('crm.opportunities.name'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium">{row.original.title}</div>
            <div className="text-muted-foreground text-xs">{row.original.partnerTitle}</div>
          </div>
        ),
      },
      {
        id: 'amount',
        header: t('crm.amount'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.amount, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'probability',
        header: t('crm.opportunities.probability'),
        cell: ({ row }) => <ProbabilityBar value={row.original.probability} />,
      },
      {
        id: 'expectedCloseDate',
        header: t('crm.opportunities.expectedClose'),
        cell: ({ row }) => (
          <span className={cn(row.original.overdue && 'text-destructive font-medium')}>
            {formatDate(row.original.expectedCloseDate)}
          </span>
        ),
      },
      {
        id: 'owner',
        header: t('crm.owner'),
        enableSorting: false,
        cell: ({ row }) => row.original.ownerName,
      },
      {
        id: 'stage',
        header: t('crm.opportunities.stage'),
        cell: ({ row }) => <StageBadge stage={row.original.stage} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      opportunitiesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'opportunities',
      [
        { header: t('trade.number'), value: (o) => o.number },
        { header: t('crm.opportunities.name'), value: (o) => o.title },
        { header: t('sales.customer'), value: (o) => o.partnerTitle },
        { header: t('crm.amount'), value: (o) => Number(o.amount) },
        { header: t('trade.currency'), value: (o) => o.currencyCode },
        { header: t('crm.opportunities.probability'), value: (o) => o.probability },
        { header: t('crm.opportunities.weighted'), value: (o) => Number(o.weightedAmount) },
        {
          header: t('crm.opportunities.expectedClose'),
          value: (o) => (o.expectedCloseDate ? new Date(o.expectedCloseDate) : null),
        },
        { header: t('crm.owner'), value: (o) => o.ownerName },
        {
          header: t('crm.opportunities.stage'),
          value: (o) => t(`crm.opportunities.stages.${o.stage}`),
        },
      ],
      rows,
    );
  };

  return (
    <DataTable
      columns={columns}
      data={data?.data}
      meta={data?.meta}
      isLoading={isLoading}
      state={table}
      onExport={handleExport}
      onRowClick={(row) => onOpen(row.id)}
      toolbar={
        <>
          <Select
            value={stage}
            onValueChange={(value) => {
              setStage(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OPEN}>{t('crm.opportunities.openOnly')}</SelectItem>
              <SelectItem value={CLOSED}>{t('crm.opportunities.closedOnly')}</SelectItem>
              <SelectItem value={ALL}>{t('crm.opportunities.allStages')}</SelectItem>
              {ALL_STAGES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`crm.opportunities.stages.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MineSwitch mine={mine} onChange={onMineChange} />
        </>
      }
    />
  );
}
