import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useProjectsAddMember,
  useProjectsRemoveMember,
  useProjectsUpdateMember,
} from '@/api/generated/endpoints/projects/projects';
import type { ProjectDetailDto, ProjectMemberDto, ProjectMemberRole } from '@/api/generated/model';
import { useEmployeeOptions } from '@/features/hr/hr-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { useFormatHours, useInvalidateProjects } from './project-components';

const toNumber = (value: string) => Number(value.replace(',', '.'));

const schema = z.object({
  employeeId: z.string().min(1, 'validation.required'),
  role: z.enum(['LEAD', 'MEMBER']),
  hourlyCost: z
    .string()
    .trim()
    .refine((value) => !value || toNumber(value) >= 0, 'validation.number'),
});
type FormValues = z.infer<typeof schema>;

export function ProjectMembersCard({ project }: { project: ProjectDetailDto }) {
  const { t } = useTranslation();
  const hours = useFormatHours();
  const invalidate = useInvalidateProjects();
  const add = useProjectsAddMember();
  const update = useProjectsUpdateMember();
  const remove = useProjectsRemoveMember();
  const [editor, setEditor] = useState<{ open: boolean; member: ProjectMemberDto | null }>({
    open: false,
    member: null,
  });
  const employees = useEmployeeOptions(editor.open && !editor.member);
  const member = editor.member;
  const candidates = employees.filter(
    (e) => !project.members.some((m) => m.employeeId === e.value),
  );

  const saved = async () => {
    toast.success(t('common.saved'));
    await invalidate();
    setEditor((s) => ({ ...s, open: false }));
  };

  const submit = (values: FormValues) => {
    const data = {
      role: values.role as ProjectMemberRole,
      hourlyCost: values.hourlyCost ? toNumber(values.hourlyCost) : null,
    };
    if (member) {
      update.mutate({ id: project.id, memberId: member.id, data }, { onSuccess: saved });
    } else {
      add.mutate(
        { id: project.id, data: { ...data, employeeId: values.employeeId } },
        { onSuccess: saved },
      );
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          {t('projects.members.title')} ({project.members.length})
        </CardTitle>
        {project.canManage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditor({ open: true, member: null })}
          >
            <UserPlus /> {t('projects.members.add')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('projects.members.employee')}</TableHead>
              <TableHead className="text-right">{t('projects.loggedHours')}</TableHead>
              {project.canSeeCosts && (
                <TableHead className="text-right">{t('projects.members.hourlyCost')}</TableHead>
              )}
              {project.canManage && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {project.members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.employeeName}</span>
                    {m.employeeId === project.managerId ? (
                      <ToneBadge tone="info">{t('projects.manager')}</ToneBadge>
                    ) : (
                      m.role === 'LEAD' && (
                        <ToneBadge tone="neutral">{t('projects.members.role.LEAD')}</ToneBadge>
                      )
                    )}
                  </div>
                  {m.positionName && (
                    <div className="text-muted-foreground text-xs">{m.positionName}</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{hours(m.loggedHours)}</TableCell>
                {project.canSeeCosts && (
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(m.hourlyCost, project.currencyCode)}
                  </TableCell>
                )}
                {project.canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('common.edit')}
                        onClick={() => setEditor({ open: true, member: m })}
                      >
                        <Pencil />
                      </Button>
                      {m.employeeId !== project.managerId && (
                        <ConfirmDialog
                          title={t('projects.members.removeTitle', { name: m.employeeName })}
                          description={t('projects.members.removeHint')}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive size-7"
                              aria-label={t('common.delete')}
                            >
                              <Trash2 />
                            </Button>
                          }
                          onConfirm={() =>
                            remove.mutate({ id: project.id, memberId: m.id }, { onSuccess: saved })
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <SimpleFormDialog<FormValues>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={member ? member.employeeName : t('projects.members.add')}
        schema={schema}
        pending={add.isPending || update.isPending}
        defaultValues={{
          employeeId: member?.employeeId ?? '',
          role: member?.role ?? 'MEMBER',
          hourlyCost: member?.hourlyCost ? String(Number(member.hourlyCost)) : '',
        }}
        fields={[
          {
            name: 'employeeId',
            label: t('projects.members.employee'),
            type: 'select',
            required: true,
            wide: true,
            disabled: !!member,
            options: member
              ? [{ value: member.employeeId, label: member.employeeName }]
              : candidates,
          },
          {
            name: 'role',
            label: t('projects.members.roleLabel'),
            type: 'select',
            required: true,
            disabled: member?.employeeId === project.managerId,
            options: (['MEMBER', 'LEAD'] as const).map((role) => ({
              value: role,
              label: t(`projects.members.role.${role}`),
            })),
          },
          {
            name: 'hourlyCost',
            label: `${t('projects.members.hourlyCost')} (${project.currencyCode})`,
            type: 'number',
          },
        ]}
        onSubmit={submit}
      />
    </Card>
  );
}
