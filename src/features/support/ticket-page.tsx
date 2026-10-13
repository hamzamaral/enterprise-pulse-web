import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  CheckCheck,
  Hand,
  Loader2,
  Lock,
  Paperclip,
  Pause,
  Play,
  RotateCcw,
  Send,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useRef, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ticketsAttachmentUrl,
  useTicketsAddComment,
  useTicketsChangeStatus,
  useTicketsFindOne,
  useTicketsRemove,
  useTicketsRemoveAttachment,
  useTicketsUpdate,
  useTicketsUploadAttachment,
} from '@/api/generated/endpoints/support/support';
import type {
  TicketDetailDto,
  TicketEventDto,
  TicketPriority,
  TicketStatus,
  UpdateTicketDto,
} from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { CvButton, Rating } from '@/features/recruitment/recruitment-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDateTime, formatRelative } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import {
  formatHours,
  PRIORITIES,
  SlaBadge,
  TicketPriorityBadge,
  TicketStatusBadge,
  useAgentOptions,
  useCategoryOptions,
  useInvalidateSupport,
} from './support-components';
import { CloseDialog, RateDialog, ReopenDialog, StatusDialog } from './ticket-dialogs';

const STATUS_ICONS: Record<TicketStatus, ComponentType<{ className?: string }>> = {
  OPEN: Undo2,
  IN_PROGRESS: Play,
  WAITING: Pause,
  RESOLVED: CheckCheck,
  CLOSED: Lock,
};

const NONE = '__none__';

export function TicketPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateSupport();
  const { data: me } = useMe();
  const { data: ticket, isLoading } = useTicketsFindOne(id);
  const [statusTo, setStatusTo] = useState<TicketStatus | null>(null);
  const [closing, setClosing] = useState(false);
  const [rating, setRating] = useState(false);
  const [reopening, setReopening] = useState(false);
  const change = useTicketsChangeStatus();
  const remove = useTicketsRemove();

  if (!ticket) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const onStatus = (status: TicketStatus) => {
    if (status !== 'IN_PROGRESS') {
      setStatusTo(status);
      return;
    }
    change.mutate(
      { id, data: { status } },
      {
        onSuccess: async () => {
          toast.success(t('support.statusChanged'));
          await invalidate();
        },
      },
    );
  };

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('support.deleted'));
          await navigate({ to: '/support' });
          await invalidate();
        },
      },
    );

  const back = ticket.isRequester && !ticket.canManage ? '/support/my' : '/support';

  return (
    <>
      <Link
        to={back}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />{' '}
        {back === '/support' ? t('support.queue.title') : t('support.my.title')}
      </Link>
      <PageHeader
        title={ticket.subject}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{ticket.number}</code>
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
            <span className="text-muted-foreground text-sm">
              {t('support.openedBy', {
                name: ticket.requesterName,
                when: formatRelative(ticket.createdAt),
              })}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {ticket.nextStatuses
              .filter((s) => s !== 'OPEN')
              .map((status) => {
                const Icon = STATUS_ICONS[status];
                return (
                  <Button
                    key={status}
                    variant={status === 'RESOLVED' ? 'default' : 'outline'}
                    disabled={change.isPending}
                    onClick={() => onStatus(status)}
                  >
                    <Icon /> {t(`support.actions.${status}`)}
                  </Button>
                );
              })}
            {ticket.canReopen && (
              <Button variant="outline" onClick={() => setReopening(true)}>
                <RotateCcw /> {t('support.reopen')}
              </Button>
            )}
            {ticket.canClose && (
              <Button
                variant={ticket.status === 'RESOLVED' ? 'default' : 'outline'}
                onClick={() => setClosing(true)}
              >
                {ticket.status === 'RESOLVED' ? <CheckCheck /> : <X />}
                {ticket.status === 'RESOLVED' ? t('support.confirmClose') : t('support.withdraw')}
              </Button>
            )}
            {ticket.canRate && (
              <Button onClick={() => setRating(true)}>
                <Star /> {t('support.rate')}
              </Button>
            )}
            {ticket.canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                onConfirm={onDelete}
              />
            )}
          </div>
        }
      />

      {ticket.isRequester && ticket.status === 'RESOLVED' && (
        <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
          {t('support.resolvedNotice')}
        </div>
      )}
      {ticket.isRequester && ticket.status === 'WAITING' && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          {t('support.waitingNotice')}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Conversation ticket={ticket} />
        </div>
        <div className="space-y-4">
          <DetailsCard ticket={ticket} meId={me?.user.id} />
          <AttachmentsCard ticket={ticket} />
          <HistoryCard events={ticket.events} />
        </div>
      </div>

      <StatusDialog
        ticket={ticket}
        status={statusTo}
        open={statusTo !== null}
        onOpenChange={(open) => !open && setStatusTo(null)}
      />
      <CloseDialog ticket={ticket} open={closing} onOpenChange={setClosing} />
      <RateDialog ticket={ticket} open={rating} onOpenChange={setRating} />
      <ReopenDialog ticket={ticket} open={reopening} onOpenChange={setReopening} />
    </>
  );
}

function Conversation({ ticket }: { ticket: TicketDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const add = useTicketsAddComment();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);

  const send = () =>
    add.mutate(
      { id: ticket.id, data: { body: body.trim(), isInternal: internal } },
      {
        onSuccess: async () => {
          setBody('');
          setInternal(false);
          toast.success(internal ? t('support.noteAdded') : t('support.replySent'));
          await invalidate();
        },
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('support.conversation')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Message
          author={ticket.requesterName}
          at={ticket.createdAt}
          body={ticket.description}
          fromRequester
        />
        {ticket.comments.map((c) => (
          <Message
            key={c.id}
            author={c.authorName}
            at={c.createdAt}
            body={c.body}
            fromRequester={c.fromRequester}
            internal={c.isInternal}
          />
        ))}
        {ticket.satisfactionRating !== null && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
            <span className="font-medium">{t('support.satisfaction')}:</span>
            <Rating value={ticket.satisfactionRating} />
            {ticket.satisfactionComment && (
              <span className="text-muted-foreground">“{ticket.satisfactionComment}”</span>
            )}
          </div>
        )}
        {ticket.canComment ? (
          <div className="space-y-2 border-t pt-4">
            <Textarea
              rows={4}
              value={body}
              maxLength={10000}
              placeholder={internal ? t('support.notePlaceholder') : t('support.replyPlaceholder')}
              aria-label={t('support.reply')}
              className={cn(internal && 'border-amber-500/50 bg-amber-500/5')}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {ticket.canManage ? (
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Switch checked={internal} onCheckedChange={setInternal} />
                  {t('support.internalNote')}
                </Label>
              ) : (
                <span />
              )}
              <Button disabled={add.isPending || !body.trim()} onClick={send}>
                {add.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                {internal ? t('support.addNote') : t('support.reply')}
              </Button>
            </div>
          </div>
        ) : (
          ticket.status === 'CLOSED' && (
            <p className="text-muted-foreground border-t pt-4 text-sm">{t('support.closedHint')}</p>
          )
        )}
      </CardContent>
    </Card>
  );
}

function Message({
  author,
  at,
  body,
  fromRequester,
  internal,
}: {
  author: string;
  at: string;
  body: string;
  fromRequester: boolean;
  internal?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        internal
          ? 'border-amber-500/30 bg-amber-500/10'
          : fromRequester
            ? 'bg-muted/40'
            : 'border-primary/20 bg-primary/5 ml-6',
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{author}</span>
        {!fromRequester && !internal && (
          <Badge variant="outline" className="text-xs font-normal">
            {t('support.supportTeam')}
          </Badge>
        )}
        {internal && (
          <Badge variant="outline" className="border-amber-500/40 text-xs font-normal">
            <Lock className="size-3" /> {t('support.internalNote')}
          </Badge>
        )}
        <span className="text-muted-foreground text-xs" title={formatDateTime(at)}>
          {formatRelative(at)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-line">{body}</p>
    </div>
  );
}

function DetailsCard({ ticket, meId }: { ticket: TicketDetailDto; meId: string | undefined }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const update = useTicketsUpdate();
  const agents = useAgentOptions(ticket.canManage);
  const categories = useCategoryOptions(ticket.categoryId);

  const save = (data: UpdateTicketDto) =>
    update.mutate(
      { id: ticket.id, data },
      {
        onSuccess: async () => {
          toast.success(t('support.updated'));
          await invalidate();
        },
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('common.details')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          <Field label={t('support.requester')}>
            {ticket.requesterName}
            <span className="text-muted-foreground block text-xs">{ticket.requesterEmail}</span>
          </Field>
          {ticket.canManage ? (
            <>
              <EditableSelect
                label={t('support.assignee')}
                value={ticket.assigneeId}
                options={agents}
                emptyLabel={t('support.unassigned')}
                disabled={update.isPending}
                onChange={(assigneeId) => save({ assigneeId })}
                extra={
                  meId &&
                  ticket.assigneeId !== meId && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      disabled={update.isPending}
                      onClick={() => save({ assigneeId: meId })}
                    >
                      <Hand className="size-3" /> {t('support.assignToMe')}
                    </Button>
                  )
                }
              />
              <EditableSelect
                label={t('support.priorityLabel')}
                value={ticket.priority}
                required
                options={PRIORITIES.map((value) => ({
                  value,
                  label: t(`support.priority.${value}`),
                }))}
                disabled={update.isPending}
                onChange={(priority) => save({ priority: priority as TicketPriority })}
              />
              <EditableSelect
                label={t('support.category')}
                value={ticket.categoryId}
                options={categories}
                emptyLabel={t('support.noCategory')}
                disabled={update.isPending}
                onChange={(categoryId) => save({ categoryId })}
              />
            </>
          ) : (
            <>
              <Field label={t('support.assignee')}>
                {ticket.assigneeName ?? t('support.unassigned')}
              </Field>
              <Field label={t('support.category')}>
                {ticket.categoryName ?? t('support.noCategory')}
              </Field>
            </>
          )}
          <SlaField
            label={t('support.sla.response')}
            state={ticket.responseSla}
            dueAt={ticket.firstResponseDueAt}
            doneAt={ticket.firstRespondedAt}
          />
          <SlaField
            label={t('support.sla.resolution')}
            state={ticket.resolutionSla}
            dueAt={ticket.resolutionDueAt}
            doneAt={ticket.resolvedAt}
            note={
              ticket.pausedMinutes > 0
                ? t('support.pausedTotal', { value: formatHours(ticket.pausedMinutes / 60) })
                : undefined
            }
          />
          {ticket.closedAt && (
            <Field label={t('support.closedAt')}>{formatDateTime(ticket.closedAt)}</Field>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function EditableSelect({
  label,
  value,
  options,
  emptyLabel,
  required,
  disabled,
  extra,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  extra?: React.ReactNode;
  onChange: (value: string | null) => void;
}) {
  return (
    <div>
      <dt className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
        {label}
        {extra}
      </dt>
      <dd>
        <Select
          value={value ?? NONE}
          disabled={disabled}
          onValueChange={(next) => {
            const normalized = next === NONE ? null : next;
            if (normalized !== value) onChange(normalized);
          }}
        >
          <SelectTrigger className="h-8 w-full" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!required && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </dd>
    </div>
  );
}

function SlaField({
  label,
  state,
  dueAt,
  doneAt,
  note,
}: {
  label: string;
  state: TicketDetailDto['responseSla'];
  dueAt: string;
  doneAt: string | null;
  note?: string;
}) {
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <span className="flex flex-wrap items-center gap-2">
        <SlaBadge state={state} />
        <span className="text-muted-foreground text-xs">
          {t('support.target', { date: formatDateTime(dueAt) })}
        </span>
      </span>
      {doneAt && (
        <span className="text-muted-foreground block text-xs">
          {t('support.doneAt', { date: formatDateTime(doneAt) })}
        </span>
      )}
      {note && <span className="text-muted-foreground block text-xs">{note}</span>}
    </Field>
  );
}

function AttachmentsCard({ ticket }: { ticket: TicketDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useTicketsUploadAttachment();
  const remove = useTicketsRemoveAttachment();

  if (!ticket.attachments.length && !ticket.canAttach) return null;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { id: ticket.id, data: { file } },
      {
        onSuccess: async () => {
          toast.success(t('support.fileAdded'));
          await invalidate();
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('support.attachments')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!ticket.attachments.length && (
          <p className="text-muted-foreground text-sm">{t('support.noAttachments')}</p>
        )}
        {ticket.attachments.map((file) => (
          <div key={file.id} className="flex items-center gap-1">
            <CvButton
              load={() => ticketsAttachmentUrl(ticket.id, file.id)}
              name={file.originalName}
              className="min-w-0 flex-1 justify-start"
            />
            {file.canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('common.delete')}
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { id: ticket.id, fileId: file.id },
                    { onSuccess: () => void invalidate() },
                  )
                }
              >
                <X />
              </Button>
            )}
          </div>
        ))}
        {ticket.canAttach && (
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              aria-label={t('support.addFile')}
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {upload.isPending ? <Loader2 className="animate-spin" /> : <Paperclip />}
              {t('support.addFile')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryCard({ events }: { events: TicketEventDto[] }) {
  const { t } = useTranslation();
  const value = (event: TicketEventDto, raw: string | null) => {
    if (raw === null) return '—';
    if (event.type === 'STATUS_CHANGED' || event.type === 'REOPENED') {
      return t(`support.status.${raw as TicketStatus}`);
    }
    if (event.type === 'PRIORITY_CHANGED') return t(`support.priority.${raw as TicketPriority}`);
    return raw;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('support.history')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {[...events].reverse().map((event) => {
            const actor = event.actorName ?? t('support.system');
            const from = value(event, event.fromValue);
            const to = value(event, event.toValue);
            return (
              <li key={event.id} className="border-l-2 pl-3 text-sm">
                {event.type === 'ASSIGNED' && event.toValue === null
                  ? t('support.events.UNASSIGNED', { actor })
                  : event.type === 'ASSIGNED' && event.actorName === null
                    ? t('support.events.AUTO_ASSIGNED', { to })
                    : t(`support.events.${event.type}`, { actor, from, to })}
                <span
                  className="text-muted-foreground block text-xs"
                  title={formatDateTime(event.createdAt)}
                >
                  {formatRelative(event.createdAt)}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
