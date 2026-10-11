import { documentAmounts, lineAmounts, parseDecimal, round2 } from './document-math';

describe('document math', () => {
  it('applies discount before VAT', () => {
    expect(lineAmounts({ quantity: 3, unitPrice: 100, discountRate: 10, vatRate: 20 })).toEqual({
      gross: 300,
      discount: 30,
      net: 270,
      vat: 54,
      total: 324,
    });
  });

  it('rounds half up like the API', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(lineAmounts({ quantity: 1.5, unitPrice: 33.335, vatRate: 18 }).total).toBe(59);
  });

  it('sums lines and groups VAT by rate', () => {
    const totals = documentAmounts([
      { quantity: 1, unitPrice: 1000, vatRate: 20 },
      { quantity: 2, unitPrice: 50, discountRate: 50, vatRate: 10 },
      { quantity: 1, unitPrice: 200, vatRate: 20 },
    ]);
    expect(totals).toMatchObject({
      subtotal: 1300,
      discountTotal: 50,
      netTotal: 1250,
      vatTotal: 245,
      grandTotal: 1495,
    });
    expect(totals.vatBreakdown).toEqual([
      { rate: 10, base: 50, vat: 5 },
      { rate: 20, base: 1200, vat: 240 },
    ]);
  });

  it('parses decimal commas', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal(3)).toBe(3);
  });
});
