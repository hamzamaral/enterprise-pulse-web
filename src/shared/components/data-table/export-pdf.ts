import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import i18n from '@/i18n';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import type { ExportColumn } from './export-excel';

const numberLocale = () => (i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR');

function formatNumber(value: number) {
  return new Intl.NumberFormat(numberLocale(), {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 3,
  }).format(value);
}

function cell(value: ReturnType<ExportColumn<unknown>['value']>): TableCell {
  if (value === null || value === undefined || value === '') return { text: '' };
  if (value instanceof Date) {
    const hasTime = value.getHours() !== 0 || value.getMinutes() !== 0;
    return { text: hasTime ? formatDateTime(value) : formatDate(value), noWrap: true };
  }
  if (typeof value === 'number') return { text: formatNumber(value), alignment: 'right' };
  if (typeof value === 'boolean') return { text: i18n.t(value ? 'common.yes' : 'common.no') };
  return { text: value };
}

/** pdfmake (≈2 MB with fonts) is only downloaded on the first PDF export. */
async function loadPdfMake() {
  const [module, fonts] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = ('default' in module ? module.default : module) as typeof module;
  pdfMake.addVirtualFileSystem(fonts.default);
  return pdfMake;
}

/** Writes rows to an A4 PDF table; wide tables switch to landscape. */
export async function exportToPdf<T>(
  fileName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  title: string,
) {
  const pdfMake = await loadPdfMake();
  const firstRow = rows[0];
  const numeric = columns.map(
    (c) => firstRow !== undefined && typeof c.value(firstRow) === 'number',
  );
  const header: TableCell[] = columns.map((c, index) => ({
    text: c.header,
    bold: true,
    fillColor: '#f1f5f9',
    alignment: numeric[index] ? 'right' : 'left',
  }));
  const body: TableCell[][] = rows.map((row) => columns.map((c) => cell(c.value(row))));
  const content: Content[] = [
    { text: title, style: 'title' },
    {
      text: `${formatDateTime(new Date())} · ${i18n.t('common.recordCount', { count: rows.length })}`,
      style: 'meta',
    },
    {
      table: {
        headerRows: 1,
        // Star columns would all take the widest minimum (e.g. an e-mail) and overflow the page.
        widths: columns.map(() => 'auto'),
        body: [header, ...body],
      },
      layout: 'lightHorizontalLines',
    },
  ];
  const definition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: columns.length > 6 ? 'landscape' : 'portrait',
    pageMargins: [28, 28, 28, 36],
    info: { title },
    defaultStyle: { font: 'Roboto', fontSize: columns.length > 10 ? 7 : 8 },
    styles: {
      title: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
      meta: { fontSize: 8, color: '#64748b', margin: [0, 0, 0, 10] },
    },
    footer: (page, pages) => ({
      text: `${page} / ${pages}`,
      alignment: 'right',
      fontSize: 7,
      color: '#64748b',
      margin: [0, 8, 28, 0],
    }),
    content,
  };
  await pdfMake
    .createPdf(definition)
    .download(`${fileName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
