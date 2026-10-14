import { describe, expect, it } from 'vitest';
import {
  bomCost,
  perUnit,
  remainingOutput,
  required,
  standardConsumption,
} from './production-rules';

describe('perUnit / required', () => {
  it('adds scrap and divides by the batch', () => {
    expect(perUnit(5, 4, 10)).toBe(0.52);
    expect(perUnit(1, 0, 1)).toBe(1);
    expect(perUnit(1, 0, 0)).toBe(0);
  });

  it('rounds the requirement up to three decimals', () => {
    expect(required(0.52, 20)).toBe(10.4);
    expect(required(1 / 3, 1)).toBe(0.334);
    expect(required(2, 3)).toBe(6);
  });
});

describe('standardConsumption', () => {
  const component = { quantityPer: 2, requiredQty: 12, consumedQty: 4 };

  it('uses the standard quantity for partial records', () => {
    expect(standardConsumption(component, 2, false)).toBe(4);
  });

  it('never issues more than what is left', () => {
    expect(standardConsumption(component, 10, false)).toBe(8);
  });

  it('takes the whole remainder on the finishing record', () => {
    expect(standardConsumption(component, 1, true)).toBe(8);
    expect(standardConsumption({ ...component, consumedQty: 13 }, 1, true)).toBe(0);
  });
});

describe('bomCost', () => {
  it('adds scrap, labour and overhead and spreads them over the batch', () => {
    const cost = bomCost(
      [
        { quantity: 5, scrapRate: 4, unitCost: 60 },
        { quantity: 20, scrapRate: 0, unitCost: 5 },
      ],
      10,
      300,
      100,
    );
    expect(cost).toEqual({ material: 412, total: 812, unitCost: 81.2 });
  });

  it('returns zero unit cost without a batch', () => {
    expect(bomCost([], 0, 10, 0).unitCost).toBe(0);
  });
});

describe('remainingOutput', () => {
  it('is never negative', () => {
    expect(remainingOutput({ quantity: '6', producedQty: '2' })).toBe(4);
    expect(remainingOutput({ quantity: '6', producedQty: '6.5' })).toBe(0);
  });
});
