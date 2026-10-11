import { useTranslation } from 'react-i18next';
import type { PermissionDto } from '@/api/generated/model';
import { Checkbox } from '@/shared/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const ACTION_ORDER = ['read', 'create', 'update', 'delete', 'start', 'send'];

interface PermissionMatrixProps {
  permissions: PermissionDto[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

/** Module × action grid. Rows can be toggled at once with the module checkbox. */
export function PermissionMatrix({
  permissions,
  value,
  onChange,
  disabled,
}: PermissionMatrixProps) {
  const { t } = useTranslation();
  const selected = new Set(value);
  const modules = [...new Set(permissions.map((p) => p.module))];
  const actions = ACTION_ORDER.filter((a) => permissions.some((p) => p.action === a));

  const toggle = (codes: string[], checked: boolean) => {
    const next = new Set(selected);
    for (const code of codes) {
      if (checked) next.add(code);
      else next.delete(code);
    }
    onChange([...next].sort());
  };

  return (
    <div className="max-h-[50vh] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="bg-muted/40 sticky top-0">
          <TableRow>
            <TableHead>{t('roles.module')}</TableHead>
            {actions.map((action) => (
              <TableHead key={action} className="text-center">
                {t(`permissions.actions.${action}` as never)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map((module) => {
            const codes = permissions.filter((p) => p.module === module).map((p) => p.code);
            const all = codes.every((c) => selected.has(c));
            const some = codes.some((c) => selected.has(c));
            return (
              <TableRow key={module}>
                <TableCell>
                  <label className="flex items-center gap-2 font-medium">
                    <Checkbox
                      disabled={disabled}
                      checked={all ? true : some ? 'indeterminate' : false}
                      onCheckedChange={(checked) => toggle(codes, checked === true)}
                    />
                    {t(`permissions.modules.${module}` as never, { defaultValue: module })}
                  </label>
                </TableCell>
                {actions.map((action) => {
                  const code = `${module}:${action}`;
                  const exists = codes.includes(code);
                  return (
                    <TableCell key={action} className="text-center">
                      {exists && (
                        <Checkbox
                          aria-label={code}
                          disabled={disabled}
                          checked={selected.has(code)}
                          onCheckedChange={(checked) => toggle([code], checked === true)}
                        />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
