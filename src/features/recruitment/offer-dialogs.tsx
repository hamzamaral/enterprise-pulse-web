import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useJobApplicationsHire,
  useJobOffersCreate,
} from '@/api/generated/endpoints/recruitment/recruitment';
import type { JobApplicationDetailDto } from '@/api/generated/model';
import { today } from '@/features/trade/trade-components';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatMoney } from '@/shared/lib/format';
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
import { useInvalidateRecruitment } from './recruitment-components';

const offerSchema = z
  .object({
    grossSalary: z.coerce
      .number({ invalid_type_error: 'validation.number' })
      .positive('validation.number'),
    startDate: z.string().min(1, 'validation.required'),
    expiresAt: z.string(),
    notes: z.string(),
  })
  .refine((d) => !d.expiresAt || d.expiresAt >= today(), {
    path: ['expiresAt'],
    message: 'recruitment.offers.expiresInPast',
  });
type OfferValues = z.infer<typeof offerSchema>;

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function OfferDialog({
  open,
  onOpenChange,
  application,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: JobApplicationDetailDto;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const create = useJobOffersCreate();
  const suggested = application.expectedSalary ?? application.salaryMax ?? application.salaryMin;

  return (
    <SimpleFormDialog<OfferValues>
      open={open}
      onOpenChange={onOpenChange}
      title={t('recruitment.offers.new')}
      description={
        (application.salaryMin || application.salaryMax || application.expectedSalary) && (
          <p className="text-muted-foreground text-sm">
            {t('recruitment.offers.hint', {
              range: [application.salaryMin, application.salaryMax]
                .filter(Boolean)
                .map((value) => formatMoney(value, application.currencyCode))
                .join(' – '),
              expected: application.expectedSalary
                ? formatMoney(application.expectedSalary, application.currencyCode)
                : '—',
            })}
          </p>
        )
      }
      schema={offerSchema}
      pending={create.isPending}
      defaultValues={{
        grossSalary: suggested ? Number(suggested) : ('' as unknown as number),
        startDate: addDays(30),
        expiresAt: addDays(7),
        notes: '',
      }}
      fields={[
        {
          name: 'grossSalary',
          label: t('recruitment.offers.grossSalary', { currency: application.currencyCode }),
          type: 'number',
          wide: true,
        },
        { name: 'startDate', label: t('recruitment.offers.startDate'), type: 'date' },
        { name: 'expiresAt', label: t('recruitment.offers.expiresAt'), type: 'date' },
        { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        create.mutate(
          {
            data: {
              applicationId: application.id,
              grossSalary: values.grossSalary,
              startDate: values.startDate,
              expiresAt: values.expiresAt || null,
              notes: values.notes.trim() || null,
            },
          },
          {
            onSuccess: async () => {
              toast.success(t('recruitment.offers.created'));
              await invalidate();
              onOpenChange(false);
            },
          },
        )
      }
    />
  );
}

/** Confirms the hire; the employee record and opening salary are created from the offer. */
export function HireDialog({
  open,
  onOpenChange,
  application,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: JobApplicationDetailDto;
}) {
  const { t } = useTranslation();
  const offer = application.offers.find((o) => o.status === 'ACCEPTED');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && offer && (
          <HireForm
            application={application}
            startDate={offer.startDate}
            salary={formatMoney(offer.grossSalary, offer.currencyCode)}
            onClose={() => onOpenChange(false)}
          />
        )}
        {open && !offer && (
          <DialogHeader>
            <DialogTitle>{t('recruitment.hire.title')}</DialogTitle>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HireForm({
  application,
  startDate,
  salary,
  onClose,
}: {
  application: JobApplicationDetailDto;
  startDate: string;
  salary: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const hire = useJobApplicationsHire();
  const [hireDate, setHireDate] = useState(startDate);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('recruitment.hire.title')}</DialogTitle>
        <DialogDescription>
          {t('recruitment.hire.description', {
            name: application.candidateName,
            position: application.positionName ?? application.postingTitle,
            department: application.departmentName ?? '—',
            salary,
          })}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="hire-date">{t('recruitment.hire.hireDate')}</Label>
        <Input
          id="hire-date"
          type="date"
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">{t('recruitment.hire.hint')}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          disabled={!hireDate || hire.isPending}
          onClick={() =>
            hire.mutate(
              { id: application.id, data: { hireDate } },
              {
                onSuccess: async (saved) => {
                  toast.success(t('recruitment.hire.done', { employeeNo: saved.employeeNo }));
                  await invalidate();
                  onClose();
                },
              },
            )
          }
        >
          {hire.isPending && <Loader2 className="animate-spin" />}
          {t('recruitment.hire.confirm')}
        </Button>
      </DialogFooter>
    </>
  );
}
