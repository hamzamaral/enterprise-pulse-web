/** Mirrors api/src/common/money/document-totals.ts so forms show the totals the API will store. */

export interface LineInput {
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  vatRate?: number;
}

export interface LineAmounts {
  gross: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
}

export interface DocumentAmounts {
  subtotal: number;
  discountTotal: number;
  netTotal: number;
  vatTotal: number;
  grandTotal: number;
  vatBreakdown: { rate: number; base: number; vat: number }[];
}

/** Half-up rounding to cents that is safe for binary floats (1.005 → 1.01). */
export const round2 = (value: number) =>
  (Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;

export function lineAmounts(line: LineInput): LineAmounts {
  const gross = round2(line.quantity * line.unitPrice);
  const discount = round2((gross * (line.discountRate ?? 0)) / 100);
  const net = round2(gross - discount);
  const vat = round2((net * (line.vatRate ?? 0)) / 100);
  return { gross, discount, net, vat, total: round2(net + vat) };
}

export function documentAmounts(lines: LineInput[]): DocumentAmounts {
  const totals = { subtotal: 0, discountTotal: 0, netTotal: 0, vatTotal: 0, grandTotal: 0 };
  const byRate = new Map<number, { rate: number; base: number; vat: number }>();
  for (const line of lines) {
    const amounts = lineAmounts(line);
    totals.subtotal += amounts.gross;
    totals.discountTotal += amounts.discount;
    totals.netTotal += amounts.net;
    totals.vatTotal += amounts.vat;
    totals.grandTotal += amounts.total;
    const rate = line.vatRate ?? 0;
    const entry = byRate.get(rate) ?? { rate, base: 0, vat: 0 };
    byRate.set(rate, { rate, base: entry.base + amounts.net, vat: entry.vat + amounts.vat });
  }
  return {
    subtotal: round2(totals.subtotal),
    discountTotal: round2(totals.discountTotal),
    netTotal: round2(totals.netTotal),
    vatTotal: round2(totals.vatTotal),
    grandTotal: round2(totals.grandTotal),
    vatBreakdown: [...byRate.values()]
      .map((b) => ({ rate: b.rate, base: round2(b.base), vat: round2(b.vat) }))
      .sort((a, b) => a.rate - b.rate),
  };
}

/** Parses user input that may use a decimal comma ("12,5"); empty or invalid → NaN. */
export const parseDecimal = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return value;
  const text = (value ?? '').trim();
  return text ? Number(text.replace(/\s/g, '').replace(',', '.')) : Number.NaN;
};

/** VAT breakdown of stored lines (amounts arrive as strings), for the totals block. */
export const storedBreakdown = (
  lines: { quantity: string; unitPrice: string; discountRate: string; vatRate: string }[],
) =>
  documentAmounts(
    lines.map((l) => ({
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountRate: Number(l.discountRate),
      vatRate: Number(l.vatRate),
    })),
  ).vatBreakdown;
