import writeXlsxFile from 'write-excel-file/browser';

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | Date | null | undefined;
}

/** Writes rows to a real .xlsx file in the browser. */
export async function exportToExcel<T>(fileName: string, columns: ExportColumn<T>[], rows: T[]) {
  const header = columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const }));
  const body = rows.map((row) =>
    columns.map((c) => {
      const value = c.value(row);
      if (value === null || value === undefined) return null;
      if (value instanceof Date) return { type: Date, value, format: 'dd.mm.yyyy hh:mm' };
      if (typeof value === 'number') return { type: Number, value };
      if (typeof value === 'boolean') return { type: Boolean, value };
      return { type: String, value };
    }),
  );
  await writeXlsxFile([header, ...body], {
    columns: columns.map(() => ({ width: 24 })),
    stickyRowsCount: 1,
  }).toFile(`${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
