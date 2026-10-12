import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getCrmSummaryQueryKey,
  getLeadsFindAllQueryKey,
  getLeadsFindOneQueryKey,
  getOpportunitiesBoardQueryKey,
  getOpportunitiesFindAllQueryKey,
  useLeadsConvert,
} from '@/api/generated/endpoints/crm/crm';
import { getPartnersFindAllQueryKey } from '@/api/generated/endpoints/partners/partners';
import type { LeadDetailDto, PartnerDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { PartnerPicker } from '@/features/partners/partner-components';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
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
import { Switch } from '@/shared/ui/switch';

/**
 * Links the lead to a new or existing customer and optionally opens an opportunity.
 * Mount it only while open so every conversion starts from the lead's values.
 */
export function ConvertLeadDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const convert = useLeadsConvert();
  const canCreatePartner = can('partners:create');
  const [mode, setMode] = useState<'new' | 'existing'>(canCreatePartner ? 'new' : 'existing');
  const [partner, setPartner] = useState<PartnerDto | null>(null);
  const [withOpportunity, setWithOpportunity] = useState(true);
  const [title, setTitle] = useState(lead.companyName);
  const [amount, setAmount] = useState(
    lead.estimatedValue ? String(Number(lead.estimatedValue)) : '',
  );
  const [closeDate, setCloseDate] = useState('');

  const amountValue = amount.trim() === '' ? undefined : Number(amount.replace(',', '.'));
  const valid =
    (mode === 'new' || !!partner) &&
    (!withOpportunity ||
      (title.trim().length >= 2 && amountValue !== undefined && amountValue >= 0));

  const submit = () =>
    convert.mutate(
      {
        id: lead.id,
        data: {
          partnerId: mode === 'existing' ? partner?.id : undefined,
          createOpportunity: withOpportunity,
          opportunityTitle: withOpportunity ? title.trim() : undefined,
          amount: withOpportunity ? amountValue : undefined,
          expectedCloseDate: withOpportunity && closeDate ? closeDate : undefined,
        },
      },
      {
        onSuccess: async (result) => {
          toast.success(t('crm.leads.converted'));
          await invalidate(
            getLeadsFindAllQueryKey(),
            getLeadsFindOneQueryKey(lead.id),
            getOpportunitiesFindAllQueryKey(),
            getOpportunitiesBoardQueryKey(),
            getCrmSummaryQueryKey(),
            getPartnersFindAllQueryKey(),
          );
          onOpenChange(false);
          if (result.opportunityId) {
            await navigate({
              to: '/crm/opportunities/$id',
              params: { id: result.opportunityId },
            });
          }
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('crm.leads.convertTitle', { number: lead.number })}</DialogTitle>
          <DialogDescription>
            {t('crm.leads.convertHint', { name: lead.companyName })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['new', 'existing'] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                disabled={value === 'new' && !canCreatePartner}
                className={cn(mode === value && 'border-primary bg-primary/5 text-primary')}
                onClick={() => setMode(value)}
              >
                {value === 'new' ? t('crm.leads.newCustomer') : t('crm.leads.existingCustomer')}
              </Button>
            ))}
          </div>
          {mode === 'existing' && (
            <div className="space-y-2">
              <Label>{t('crm.leads.customer')}</Label>
              <PartnerPicker value={partner} onChange={setPartner} type="CUSTOMER" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch
              id="convert-opportunity"
              checked={withOpportunity}
              onCheckedChange={setWithOpportunity}
            />
            <Label htmlFor="convert-opportunity">{t('crm.leads.createOpportunity')}</Label>
          </div>
          {withOpportunity && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="convert-title">{t('crm.leads.opportunityTitle')}</Label>
                <Input
                  id="convert-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="convert-amount">
                  {t('crm.amount')} ({lead.currencyCode})
                </Label>
                <Input
                  id="convert-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="convert-close">{t('crm.opportunities.expectedClose')}</Label>
                <Input
                  id="convert-close"
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid || convert.isPending} onClick={submit}>
            {convert.isPending && <Loader2 className="animate-spin" />}
            {t('crm.leads.convert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
