import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getCrmSummaryQueryKey,
  getOpportunitiesBoardQueryKey,
  getOpportunitiesFindAllQueryKey,
  getOpportunitiesFindOneQueryKey,
  useOpportunitiesChangeStage,
  useOpportunitiesLose,
  useOpportunitiesReopen,
  useOpportunitiesWin,
} from '@/api/generated/endpoints/crm/crm';
import type { OpportunityStage } from '@/api/generated/model';
import { useInvalidate } from '@/shared/lib/query';

interface Target {
  id: string;
  number: string;
}

/** Stage changes, win / lose / reopen with every pipeline view refreshed. */
export function useOpportunityActions() {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const changeStage = useOpportunitiesChangeStage();
  const win = useOpportunitiesWin();
  const lose = useOpportunitiesLose();
  const reopen = useOpportunitiesReopen();

  const refresh = (id: string) =>
    invalidate(
      getOpportunitiesBoardQueryKey(),
      getOpportunitiesFindAllQueryKey(),
      getOpportunitiesFindOneQueryKey(id),
      getCrmSummaryQueryKey(),
    );
  const done = (id: string, message: string, after?: () => void) => ({
    onSuccess: async () => {
      toast.success(message);
      after?.();
      await refresh(id);
    },
  });

  return {
    pending: changeStage.isPending || win.isPending || lose.isPending || reopen.isPending,
    move: (target: Target, stage: OpportunityStage) =>
      changeStage.mutate(
        { id: target.id, data: { stage } },
        done(
          target.id,
          t('crm.opportunities.moved', {
            number: target.number,
            stage: t(`crm.opportunities.stages.${stage}`),
          }),
        ),
      ),
    win: (target: Target) =>
      win.mutate({ id: target.id }, done(target.id, t('crm.opportunities.won'))),
    lose: (target: Target, reason: string, after?: () => void) =>
      lose.mutate(
        { id: target.id, data: { reason } },
        done(target.id, t('crm.opportunities.lost'), after),
      ),
    reopen: (target: Target) =>
      reopen.mutate({ id: target.id }, done(target.id, t('crm.opportunities.reopened'))),
  };
}
