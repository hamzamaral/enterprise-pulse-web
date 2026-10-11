import { v } from './validation';

describe('validation helpers', () => {
  it('requires a non-blank string', () => {
    expect(v.requiredString().safeParse('  ').success).toBe(false);
    expect(v.requiredString().parse('  ok ')).toBe('ok');
  });

  it('turns an empty optional string into undefined', () => {
    expect(v.optionalString().parse('   ')).toBeUndefined();
  });

  it.each([
    ['Admin123!', true],
    ['admin123', false],
    ['ADMIN1234', false],
    ['Short1', false],
  ])('validates password %s', (password, valid) => {
    expect(v.password().safeParse(password).success).toBe(valid);
  });

  it('returns i18n keys as messages', () => {
    const result = v.email().safeParse('not-an-email');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.email');
  });

  it('accepts upper case codes only', () => {
    expect(v.code().safeParse('IST-01').success).toBe(true);
    expect(v.code().safeParse('ist').success).toBe(false);
  });
});
