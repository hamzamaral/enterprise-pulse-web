import type { MeResponseDto } from '@/api/generated/model';
import { hasPermission } from './session';

const me = (
  overrides: Partial<MeResponseDto['user']> = {},
  permissions: string[] = [],
): MeResponseDto => ({
  user: {
    id: 'u1',
    email: 'user@enterprisepulse.dev',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    avatarUrl: null,
    locale: 'tr',
    isSuperAdmin: false,
    twoFactorEnabled: false,
    ...overrides,
  },
  companies: [],
  activeCompanyId: 'c1',
  activeBranchId: null,
  permissions,
});

describe('hasPermission', () => {
  it('denies when there is no session', () => {
    expect(hasPermission(undefined, 'users:read')).toBe(false);
  });

  it('checks the permission list', () => {
    const user = me({}, ['users:read']);
    expect(hasPermission(user, 'users:read')).toBe(true);
    expect(hasPermission(user, 'users:delete')).toBe(false);
  });

  it('allows everything for super admins', () => {
    expect(hasPermission(me({ isSuperAdmin: true }), 'roles:delete')).toBe(true);
  });
});
