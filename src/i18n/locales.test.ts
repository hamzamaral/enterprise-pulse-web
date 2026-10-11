import en from './locales/en.json';
import tr from './locales/tr.json';

function keys(node: object, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('locales', () => {
  it('define the same keys in Turkish and English', () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });
});
