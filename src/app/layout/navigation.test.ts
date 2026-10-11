import { findActiveNavTarget } from './navigation';

describe('findActiveNavTarget', () => {
  it('prefers the most specific matching entry', () => {
    expect(findActiveNavTarget('/assets/my')).toBe('/assets/my');
    expect(findActiveNavTarget('/assets/assignments/42')).toBe('/assets/assignments');
    expect(findActiveNavTarget('/assets/0b9c')).toBe('/assets');
  });

  it('matches whole path segments only', () => {
    expect(findActiveNavTarget('/')).toBe('/');
    expect(findActiveNavTarget('/users')).toBe('/users');
    expect(findActiveNavTarget('/usersx')).toBeUndefined();
  });
});
