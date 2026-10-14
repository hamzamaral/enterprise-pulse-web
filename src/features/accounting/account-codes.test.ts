import { describe, expect, it } from 'vitest';
import { ACCOUNT_CODE, nextChildCode } from './account-codes';

describe('ACCOUNT_CODE', () => {
  it('accepts main and dotted sub-account codes', () => {
    for (const code of ['100', '120.01', '770.10.2', '689'])
      expect(ACCOUNT_CODE.test(code)).toBe(true);
  });

  it('rejects codes outside the uniform chart', () => {
    for (const code of ['', '99', '800', '1000', '120.', '120.12345', '12a']) {
      expect(ACCOUNT_CODE.test(code)).toBe(false);
    }
  });
});

describe('nextChildCode', () => {
  it('starts at 01', () => {
    expect(nextChildCode('120', ['100', '120', '1200'])).toBe('120.01');
  });

  it('continues after the highest direct child and ignores deeper levels', () => {
    expect(nextChildCode('120', ['120', '120.01', '120.07', '120.07.1', '121.09'])).toBe('120.08');
    expect(nextChildCode('120.07', ['120.07', '120.07.1'])).toBe('120.07.02');
  });
});
