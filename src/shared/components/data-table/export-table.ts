import { type ExportColumn, exportToExcel } from './export-excel';

export type ExportFormat = 'xlsx' | 'pdf';
export type { ExportColumn };

/**
 * Exports rows as Excel or PDF. The PDF title defaults to the page heading so list pages
 * don't have to repeat it.
 */
export async function exportTable<T>(
  format: ExportFormat,
  fileName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  title?: string,
) {
  if (format === 'xlsx') return exportToExcel(fileName, columns, rows);
  const { exportToPdf } = await import('./export-pdf');
  const heading = document.querySelector('main h1')?.textContent?.trim();
  return exportToPdf(fileName, columns, rows, title ?? heading ?? fileName);
}
