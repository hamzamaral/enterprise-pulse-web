import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import type { ExportFormat } from './export-table';

/** "Export" button with an Excel / PDF choice. */
export function ExportMenu({
  onExport,
  disabled,
  size,
  className,
}: {
  onExport: (format: ExportFormat) => void | Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const run = async (format: ExportFormat) => {
    setBusy(true);
    try {
      await onExport(format);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled || busy} className={className}>
          <Download />
          {t('common.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run('xlsx')}>
          <FileSpreadsheet /> {t('common.exportExcel')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('pdf')}>
          <FileText /> {t('common.exportPdf')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
