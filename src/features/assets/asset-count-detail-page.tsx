import { Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import {
  ArrowLeft,
  Camera,
  CheckCheck,
  CircleCheck,
  CircleX,
  Loader2,
  Printer,
  ScanQrCode,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getAssetCountsFindAllQueryKey,
  getAssetCountsFindOneQueryKey,
  getAssetsFindAllQueryKey,
  useAssetCountsCancel,
  useAssetCountsComplete,
  useAssetCountsFindOne,
  useAssetCountsRemoveLine,
  useAssetCountsScan,
  useAssetCountsUpdateLine,
} from '@/api/generated/endpoints/assets/assets';
import {
  AssetCondition,
  type AssetCountLineDto,
  type AssetScanResultDto,
} from '@/api/generated/model';
import { getErrorMessage } from '@/api/http';
import { usePermission } from '@/features/auth/use-session';
import { CameraScanner, cameraScanSupported } from '@/shared/components/camera-scanner';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ConditionBadge } from './asset-components';
import { AssetCountProgress, AssetCountStatusBadge, scopeLabel } from './asset-counts-page';

type LineFilter = 'all' | 'found' | 'missing' | 'unexpected';
const NOT_SET = '__none__';

function LineResult({ line }: { line: AssetCountLineDto }) {
  const { t } = useTranslation();
  if (!line.expected) {
    return <ToneBadge tone="warning">{t('assets.counts.lineStatus.UNEXPECTED')}</ToneBadge>;
  }
  return line.found ? (
    <ToneBadge tone="success">{t('assets.counts.lineStatus.FOUND')}</ToneBadge>
  ) : (
    <ToneBadge tone="danger">{t('assets.counts.lineStatus.MISSING')}</ToneBadge>
  );
}

const matches = (line: AssetCountLineDto, filter: LineFilter) =>
  filter === 'all' ||
  (filter === 'unexpected' && !line.expected) ||
  (filter === 'found' && line.expected && line.found) ||
  (filter === 'missing' && line.expected && !line.found);

export function AssetCountDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidate = useInvalidate();
  const { data: count, isLoading } = useAssetCountsFindOne(id);
  const scan = useAssetCountsScan({ mutation: { meta: { handlesErrors: true } } });
  const updateLine = useAssetCountsUpdateLine();
  const removeLine = useAssetCountsRemoveLine();
  const complete = useAssetCountsComplete();
  const cancel = useAssetCountsCancel();
  const [filter, setFilter] = useState<LineFilter>('all');
  const [code, setCode] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const lines = useMemo(
    () => (count?.lines ?? []).filter((line) => matches(line, filter)),
    [count, filter],
  );

  if (isLoading || !count) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const editable = count.status === 'DRAFT' && can('assets:count');
  const refresh = () =>
    invalidate(getAssetCountsFindOneQueryKey(id), getAssetCountsFindAllQueryKey());

  const announce = ({ result, line }: AssetScanResultDto) => {
    const tag = line.assetTag;
    if (result === 'FOUND') toast.success(t('assets.counts.scanFound', { tag }));
    else if (result === 'ALREADY_FOUND') toast.info(t('assets.counts.scanAlready', { tag }));
    else toast.warning(t('assets.counts.scanUnexpected', { tag }));
  };

  const submitScan = (value: string) => {
    if (!value.trim() || scan.isPending) return;
    scan.mutate(
      { id, data: { code: value.trim() } },
      {
        onSuccess: async (result) => {
          announce(result);
          setLastScanned(result.line.id);
          setCode('');
          await refresh();
        },
        onError: (error) => {
          const notFound = isAxiosError(error) && error.response?.status === 404;
          toast.error(
            notFound
              ? t('assets.counts.scanNotFound', { code: value.trim() })
              : getErrorMessage(error),
          );
        },
      },
    );
  };

  const patchLine = (lineId: string, data: Parameters<typeof updateLine.mutate>[0]['data']) =>
    updateLine.mutate({ id, lineId, data }, { onSuccess: async () => void (await refresh()) });

  return (
    <>
      <Link
        to="/assets/counts"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm print:hidden"
      >
        <ArrowLeft className="size-4" /> {t('assets.counts.title')}
      </Link>
      <PageHeader
        title={`${t('assets.counts.sheet')} ${count.number}`}
        description={`${scopeLabel(count, t('assets.counts.allAssets'))} · ${formatDate(count.countDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <AssetCountStatusBadge status={count.status} />
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t('assets.counts.print')}
            </Button>
            {editable && (
              <>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="text-destructive">
                      <XCircle /> {t('assets.counts.cancelCount')}
                    </Button>
                  }
                  title={t('assets.counts.cancelTitle')}
                  description={t('assets.counts.cancelDescription')}
                  confirmLabel={t('assets.counts.cancelCount')}
                  onConfirm={() =>
                    cancel.mutate({ id }, { onSuccess: async () => void (await refresh()) })
                  }
                />
                <ConfirmDialog
                  trigger={
                    <Button disabled={complete.isPending}>
                      {complete.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
                      {t('assets.counts.complete')}
                    </Button>
                  }
                  title={t('assets.counts.completeTitle')}
                  description={t('assets.counts.completeDescription', {
                    count: count.missingCount,
                  })}
                  confirmLabel={t('assets.counts.complete')}
                  onConfirm={() =>
                    complete.mutate(
                      { id, data: { applyConditions: true } },
                      {
                        onSuccess: async () => {
                          toast.success(t('assets.counts.completed'));
                          await Promise.all([refresh(), invalidate(getAssetsFindAllQueryKey())]);
                        },
                      },
                    )
                  }
                />
              </>
            )}
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <Field label={t('assets.counts.progress')}>
            <AssetCountProgress count={count} />
          </Field>
          <Field label={t('assets.counts.found')}>{count.foundCount}</Field>
          <Field label={t('assets.counts.missing')}>
            <span className={cn(count.missingCount && 'text-destructive font-medium')}>
              {count.missingCount}
            </span>
          </Field>
          <Field label={t('assets.counts.unexpected')}>
            <span className={cn(count.unexpectedCount && 'font-medium text-amber-600')}>
              {count.unexpectedCount}
            </span>
          </Field>
          <Field label={t('assets.counts.createdBy')}>
            {count.createdByName}
            {count.completedAt && (
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(count.completedAt)}
              </span>
            )}
          </Field>
          {count.notes && (
            <div className="sm:col-span-2 lg:col-span-5">
              <Field label={t('common.notes')}>{count.notes}</Field>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as LineFilter)}>
          <TabsList>
            {(['all', 'found', 'missing', 'unexpected'] as const).map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(`assets.counts.filters.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {editable && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <form
              className="relative flex-1 sm:w-80"
              onSubmit={(e) => {
                e.preventDefault();
                submitScan(code);
              }}
            >
              <ScanQrCode className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('assets.counts.scanPlaceholder')}
                aria-label={t('assets.counts.scanPlaceholder')}
                className="pl-8"
                autoFocus
              />
            </form>
            {cameraScanSupported() && (
              <Button variant="outline" onClick={() => setCameraOpen(true)}>
                <Camera /> {t('assets.counts.camera')}
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('assets.assetTag')}</TableHead>
                <TableHead>{t('assets.asset')}</TableHead>
                <TableHead>{t('assets.serialNumber')}</TableHead>
                <TableHead>{t('assets.counts.expectedHolder')}</TableHead>
                <TableHead>{t('assets.counts.result')}</TableHead>
                <TableHead>{t('assets.counts.observedCondition')}</TableHead>
                <TableHead>{t('assets.counts.foundBy')}</TableHead>
                {editable && <TableHead className="w-20 print:hidden" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length ? (
                lines.map((line) => (
                  <TableRow key={line.id} className={cn(line.id === lastScanned && 'bg-primary/5')}>
                    <TableCell>
                      <Link
                        to="/assets/$id"
                        params={{ id: line.assetId }}
                        className="text-primary font-mono text-xs hover:underline"
                      >
                        {line.assetTag}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{line.assetName}</div>
                      <div className="text-muted-foreground text-xs">{line.categoryName}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{line.serialNumber ?? '—'}</TableCell>
                    <TableCell>{line.expectedHolder ?? '—'}</TableCell>
                    <TableCell>
                      <LineResult line={line} />
                    </TableCell>
                    <TableCell>
                      {editable && line.found && (
                        <span className="hidden print:inline">
                          {line.condition ? t(`assets.conditions.${line.condition}`) : '—'}
                        </span>
                      )}
                      {editable && line.found ? (
                        <Select
                          value={line.condition ?? NOT_SET}
                          onValueChange={(value) =>
                            patchLine(line.id, {
                              condition: value === NOT_SET ? null : (value as AssetCondition),
                            })
                          }
                        >
                          <SelectTrigger
                            className="h-8 w-36 print:hidden"
                            aria-label={t('assets.counts.observedCondition')}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NOT_SET}>
                              {t('assets.counts.sameCondition')}
                            </SelectItem>
                            {Object.values(AssetCondition).map((value) => (
                              <SelectItem key={value} value={value}>
                                {t(`assets.conditions.${value}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : line.condition ? (
                        <ConditionBadge condition={line.condition} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {line.foundByName ?? '—'}
                      {line.foundAt && (
                        <span className="text-muted-foreground block text-xs">
                          {formatDateTime(line.foundAt)}
                        </span>
                      )}
                    </TableCell>
                    {editable && (
                      <TableCell className="text-right print:hidden">
                        {!line.expected ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('assets.counts.remove')}
                            title={t('assets.counts.remove')}
                            onClick={() =>
                              removeLine.mutate(
                                { id, lineId: line.id },
                                { onSuccess: async () => void (await refresh()) },
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        ) : line.found ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('assets.counts.markMissing')}
                            title={t('assets.counts.markMissing')}
                            onClick={() => patchLine(line.id, { found: false })}
                          >
                            <CircleX />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('assets.counts.markFound')}
                            title={t('assets.counts.markFound')}
                            onClick={() => patchLine(line.id, { found: true })}
                          >
                            <CircleCheck />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editable && (
        <CameraScanner open={cameraOpen} onOpenChange={setCameraOpen} onDetected={submitScan} />
      )}
    </>
  );
}
