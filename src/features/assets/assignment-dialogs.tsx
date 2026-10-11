import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getAssetAssignmentsFindAllQueryKey,
  getAssetsFindAllQueryKey,
  getAssetsFindOneQueryKey,
  useAssetsAssign,
  useAssetsReturnAsset,
  useAssetsTransfer,
} from '@/api/generated/endpoints/assets/assets';
import {
  AssetCondition,
  AssigneeType,
  type AssetDto,
  type AssignmentDto,
} from '@/api/generated/model';
import { useDepartmentOptions, useEmployeeOptions } from '@/features/hr/hr-components';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { today, useLocationOptions } from './asset-components';

const assignSchema = z
  .object({
    assigneeType: z.nativeEnum(AssigneeType),
    assigneeId: v.requiredString(),
    assignedAt: v.requiredString(),
    expectedReturnDate: z.string(),
    notes: z.string(),
  })
  .refine((value) => !value.expectedReturnDate || value.expectedReturnDate >= value.assignedAt, {
    path: ['expectedReturnDate'],
    message: 'validation.dateRange',
  });
type AssignValues = z.infer<typeof assignSchema>;

const ID_FIELD = {
  EMPLOYEE: 'employeeId',
  DEPARTMENT: 'departmentId',
  LOCATION: 'locationId',
} as const satisfies Record<AssigneeType, string>;

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Pick<AssetDto, 'id' | 'assetTag' | 'name'>;
  /** Transfer closes the current assignment and opens a new one in one step. */
  mode: 'assign' | 'transfer';
  onDone?: (assignment: AssignmentDto) => void;
}

export function AssignDialog({ open, onOpenChange, asset, mode, onDone }: AssignDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const assign = useAssetsAssign();
  const transfer = useAssetsTransfer();
  const form = useForm<AssignValues>({ resolver: zodResolver(assignSchema) });
  const assigneeType = useWatch({ control: form.control, name: 'assigneeType' });

  const employeeOptions = useEmployeeOptions(open && assigneeType === 'EMPLOYEE');
  const departmentOptions = useDepartmentOptions(open && assigneeType === 'DEPARTMENT');
  const locationOptions = useLocationOptions(open && assigneeType === 'LOCATION');
  const options =
    assigneeType === 'DEPARTMENT'
      ? departmentOptions
      : assigneeType === 'LOCATION'
        ? locationOptions
        : employeeOptions;

  useEffect(() => {
    if (!open) return;
    form.reset({
      assigneeType: AssigneeType.EMPLOYEE,
      assigneeId: '',
      assignedAt: today(),
      expectedReturnDate: '',
      notes: '',
    });
  }, [open, form]);

  const onSubmit = (values: AssignValues) => {
    const data = {
      assigneeType: values.assigneeType,
      [ID_FIELD[values.assigneeType]]: values.assigneeId,
      assignedAt: values.assignedAt,
      expectedReturnDate: values.expectedReturnDate || undefined,
      notes: values.notes || undefined,
    };
    const mutation = mode === 'transfer' ? transfer : assign;
    mutation.mutate(
      { id: asset.id, data },
      {
        onSuccess: async (assignment) => {
          toast.success(t(mode === 'transfer' ? 'assets.transferred' : 'assets.assigned'));
          await invalidate(
            getAssetsFindAllQueryKey(),
            getAssetsFindOneQueryKey(asset.id),
            getAssetAssignmentsFindAllQueryKey(),
          );
          onOpenChange(false);
          onDone?.(assignment);
        },
      },
    );
  };

  const pending = assign.isPending || transfer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(mode === 'transfer' ? 'assets.transferTitle' : 'assets.assignTitle')}
          </DialogTitle>
          <p className="text-muted-foreground text-sm">
            {asset.assetTag} · {asset.name}
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="assigneeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('assets.assigneeType')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('assigneeId', '');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(AssigneeType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`assets.assigneeTypes.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('assets.assignee')}</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('common.select')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('assets.assignedAt')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedReturnDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('assets.expectedReturnDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.notes')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {t(mode === 'transfer' ? 'assets.transfer' : 'assets.assign')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const returnSchema = z.object({
  returnedAt: v.requiredString(),
  conditionIn: z.nativeEnum(AssetCondition),
  locationId: z.string(),
  returnNotes: z.string(),
});
type ReturnValues = z.infer<typeof returnSchema>;

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Pick<AssetDto, 'id' | 'assetTag' | 'name' | 'condition' | 'locationId'>;
}

export function ReturnDialog({ open, onOpenChange, asset }: ReturnDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const returnAsset = useAssetsReturnAsset();
  const locationOptions = useLocationOptions(open);

  return (
    <SimpleFormDialog<ReturnValues>
      open={open}
      onOpenChange={onOpenChange}
      title={`${t('assets.returnTitle')} · ${asset.assetTag}`}
      schema={returnSchema}
      pending={returnAsset.isPending}
      defaultValues={{
        returnedAt: today(),
        conditionIn: asset.condition,
        locationId: asset.locationId ?? '',
        returnNotes: '',
      }}
      fields={[
        { name: 'returnedAt', label: t('assets.returnedAt'), type: 'date' },
        {
          name: 'conditionIn',
          label: t('assets.conditionIn'),
          type: 'select',
          required: true,
          options: Object.values(AssetCondition).map((c) => ({
            value: c,
            label: t(`assets.conditions.${c}`),
          })),
        },
        {
          name: 'locationId',
          label: t('assets.returnLocation'),
          type: 'select',
          options: locationOptions,
          wide: true,
        },
        { name: 'returnNotes', label: t('common.notes'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        returnAsset.mutate(
          {
            id: asset.id,
            data: {
              returnedAt: values.returnedAt,
              conditionIn: values.conditionIn,
              locationId: values.locationId || undefined,
              returnNotes: values.returnNotes || undefined,
            },
          },
          {
            onSuccess: async () => {
              toast.success(t('assets.returned'));
              await invalidate(
                getAssetsFindAllQueryKey(),
                getAssetsFindOneQueryKey(asset.id),
                getAssetAssignmentsFindAllQueryKey(),
              );
              onOpenChange(false);
            },
          },
        )
      }
    />
  );
}
