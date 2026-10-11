import { formatAttributes, parseAttributes } from './inventory-components';
import { parseSerials } from './movement-form-page';

describe('inventory parsers', () => {
  it('parses variant attributes from "key=value" pairs', () => {
    expect(parseAttributes('Renk=Siyah, Beden = M; bozuk')).toEqual({ Renk: 'Siyah', Beden: 'M' });
    expect(parseAttributes('  ')).toBeNull();
    expect(formatAttributes({ Renk: 'Siyah', Beden: 'M' })).toBe('Renk=Siyah, Beden=M');
    expect(formatAttributes(null)).toBe('');
  });

  it('splits serial numbers by line or comma and drops blanks and duplicates', () => {
    expect(parseSerials('SN-1\nSN-2, SN-3\n\nSN-1 ')).toEqual(['SN-1', 'SN-2', 'SN-3']);
    expect(parseSerials('')).toEqual([]);
  });
});
