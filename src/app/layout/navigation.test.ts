import { Box } from 'lucide-react';
import {
  filterNavigation,
  findActiveNavTarget,
  normalizeSearch,
  type NavGroup,
} from './navigation';

const GROUPS: NavGroup[] = [
  {
    labelKey: 'İnsan Kaynakları',
    items: [
      { labelKey: 'İzin Talepleri', icon: Box },
      { labelKey: 'Personel', icon: Box },
    ],
  },
  {
    labelKey: 'Satış',
    items: [
      { labelKey: 'Siparişler', icon: Box },
      { labelKey: 'Faturalar', icon: Box },
    ],
  },
  {
    labelKey: 'Satın Alma',
    items: [{ labelKey: 'Faturalar', icon: Box }],
  },
];
const search = (query: string) =>
  filterNavigation(GROUPS, query, (key) => key).map(
    (group) => `${group.labelKey}: ${group.items.map((item) => item.labelKey).join(', ')}`,
  );

describe('normalizeSearch', () => {
  it('folds Turkish letters and accents', () => {
    expect(normalizeSearch(' İzin Talepleri ')).toBe('izin talepleri');
    expect(normalizeSearch('SATIŞ')).toBe('satis');
    expect(normalizeSearch('Çek / Senet')).toBe('cek / senet');
  });
});

describe('filterNavigation', () => {
  it('keeps everything for an empty query', () => {
    expect(filterNavigation(GROUPS, '  ', (key) => key)).toBe(GROUPS);
  });

  it('finds items without Turkish characters', () => {
    expect(search('izin')).toEqual(['İnsan Kaynakları: İzin Talepleri']);
    expect(search('siparis')).toEqual(['Satış: Siparişler']);
  });

  it('keeps the whole group when the group name matches', () => {
    expect(search('insan')).toEqual(['İnsan Kaynakları: İzin Talepleri, Personel']);
  });

  it('combines group and item words', () => {
    expect(search('fatura')).toEqual(['Satış: Faturalar', 'Satın Alma: Faturalar']);
    expect(search('satin fatura')).toEqual(['Satın Alma: Faturalar']);
    expect(search('bordro')).toEqual([]);
  });
});

describe('findActiveNavTarget', () => {
  it('prefers the most specific matching entry', () => {
    expect(findActiveNavTarget('/assets/my')).toBe('/assets/my');
    expect(findActiveNavTarget('/assets/assignments/42')).toBe('/assets/assignments');
    expect(findActiveNavTarget('/assets/0b9c')).toBe('/assets');
    expect(findActiveNavTarget('/inventory/movements/new')).toBe('/inventory/movements');
    expect(findActiveNavTarget('/inventory/products/0b9c')).toBe('/inventory/products');
    expect(findActiveNavTarget('/inventory')).toBe('/inventory');
  });

  it('matches whole path segments only', () => {
    expect(findActiveNavTarget('/')).toBe('/');
    expect(findActiveNavTarget('/users')).toBe('/users');
    expect(findActiveNavTarget('/usersx')).toBeUndefined();
  });
});
