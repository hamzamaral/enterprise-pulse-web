import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useTicketsChangeStatus,
  useTicketsClose,
  useTicketsRate,
  useTicketsReopen,
} from '@/api/generated/endpoints/support/support';
import type { TicketDetailDto, TicketStatus } from '@/api/generated/model';
import { Rating } from '@/features/recruitment/recruitment-components';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { useInvalidateSupport } from './support-components';

interface DialogProps {
  ticket: TicketDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** An agent moves the ticket on, optionally with a public message to the requester. */
export function StatusDialog({ status, ...props }: DialogProps & { status: TicketStatus | null }) {
  const { t } = useTranslation();
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {props.open && status && (
          <>
            <DialogHeader>
              <DialogTitle>{t(`support.actions.${status}`)}</DialogTitle>
            </DialogHeader>
            <StatusForm {...props} status={status} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusForm({ ticket, onOpenChange, status }: DialogProps & { status: TicketStatus }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const change = useTicketsChangeStatus();
  const [comment, setComment] = useState('');
  const needsMessage = status === 'WAITING';

  const submit = () =>
    change.mutate(
      { id: ticket.id, data: { status, comment: comment.trim() || undefined } },
      {
        onSuccess: async () => {
          toast.success(t('support.statusChanged'));
          onOpenChange(false);
          await invalidate();
        },
      },
    );

  return (
    <>
      <p className="text-muted-foreground text-sm">{t(`support.statusHints.${status}`)}</p>
      <div className="space-y-2">
        <Label htmlFor="status-comment">
          {needsMessage ? t('support.questionLabel') : t('support.messageLabel')}
        </Label>
        <Textarea
          id="status-comment"
          rows={4}
          value={comment}
          maxLength={10000}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button disabled={change.isPending || (needsMessage && !comment.trim())} onClick={submit}>
          {change.isPending && <Loader2 className="animate-spin" />}
          {t(`support.actions.${status}`)}
        </Button>
      </DialogFooter>
    </>
  );
}

/** The requester closes the ticket and may rate the support received. */
export function CloseDialog(props: DialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {props.open && (
          <>
            <DialogHeader>
              <DialogTitle>
                {props.ticket.status === 'RESOLVED'
                  ? t('support.confirmClose')
                  : t('support.close')}
              </DialogTitle>
            </DialogHeader>
            <RatingForm {...props} mode="close" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RateDialog(props: DialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {props.open && (
          <>
            <DialogHeader>
              <DialogTitle>{t('support.rate')}</DialogTitle>
            </DialogHeader>
            <RatingForm {...props} mode="rate" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RatingForm({ ticket, onOpenChange, mode }: DialogProps & { mode: 'close' | 'rate' }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const close = useTicketsClose();
  const rate = useTicketsRate();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const pending = close.isPending || rate.isPending;

  const onSuccess = async () => {
    toast.success(mode === 'close' ? t('support.closed') : t('support.rated'));
    onOpenChange(false);
    await invalidate();
  };
  const submit = () => {
    const text = comment.trim() || undefined;
    if (mode === 'rate' && rating) {
      rate.mutate({ id: ticket.id, data: { rating, comment: text } }, { onSuccess });
    } else {
      close.mutate({ id: ticket.id, data: rating ? { rating, comment: text } : {} }, { onSuccess });
    }
  };

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {mode === 'close' && ticket.status !== 'RESOLVED'
          ? t('support.closeHint')
          : t('support.rateHint')}
      </p>
      <div className="space-y-2">
        <Label>{t('support.satisfaction')}</Label>
        <Rating value={rating} onChange={setRating} size="md" label={t('support.satisfaction')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rating-comment">{t('support.ratingComment')}</Label>
        <Textarea
          id="rating-comment"
          rows={3}
          value={comment}
          maxLength={2000}
          disabled={!rating}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button disabled={pending || (mode === 'rate' && !rating)} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === 'close' ? t('support.close') : t('support.rate')}
        </Button>
      </DialogFooter>
    </>
  );
}

/** The requester says the problem is not solved. */
export function ReopenDialog(props: DialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {props.open && (
          <>
            <DialogHeader>
              <DialogTitle>{t('support.reopen')}</DialogTitle>
            </DialogHeader>
            <ReopenForm {...props} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReopenForm({ ticket, onOpenChange }: DialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const reopen = useTicketsReopen();
  const [comment, setComment] = useState('');

  const submit = () =>
    reopen.mutate(
      { id: ticket.id, data: { comment: comment.trim() } },
      {
        onSuccess: async () => {
          toast.success(t('support.reopened'));
          onOpenChange(false);
          await invalidate();
        },
      },
    );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="reopen-comment">{t('support.reopenLabel')}</Label>
        <Textarea
          id="reopen-comment"
          rows={4}
          value={comment}
          maxLength={10000}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button disabled={reopen.isPending || comment.trim().length < 3} onClick={submit}>
          {reopen.isPending && <Loader2 className="animate-spin" />}
          {t('support.reopen')}
        </Button>
      </DialogFooter>
    </>
  );
}
