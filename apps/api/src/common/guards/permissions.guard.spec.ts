import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import type { PermissionFlag } from '@career-compass/shared';

function makeContext(employeeContext: { role: string } | undefined): ExecutionContext {
  const request = { employeeContext };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
  } as unknown as ExecutionContext;
}

function makeReflector(required: PermissionFlag[] | undefined): Reflector {
  return { getAllAndOverride: () => required } as unknown as Reflector;
}

describe('PermissionsGuard', () => {
  it('passes through when no @RequirePermission is declared', () => {
    const guard = new PermissionsGuard(makeReflector(undefined));
    expect(guard.canActivate(makeContext({ role: 'MEMBER' }))).toBe(true);
  });

  it('allows ADMIN through an ADMIN-only route', () => {
    const guard = new PermissionsGuard(makeReflector(['EMPLOYEE_DATA_MANAGE']));
    expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('denies MEMBER on an EMPLOYEE_DATA_MANAGE route', () => {
    const guard = new PermissionsGuard(makeReflector(['EMPLOYEE_DATA_MANAGE']));
    expect(() => guard.canActivate(makeContext({ role: 'MEMBER' }))).toThrow();
  });

  it('denies UL on a USER_ROLE_MANAGE route (UL only has APP_EDIT/UNIT_SCOPE_OWN)', () => {
    const guard = new PermissionsGuard(makeReflector(['USER_ROLE_MANAGE']));
    expect(() => guard.canActivate(makeContext({ role: 'UL' }))).toThrow();
  });

  it('denies when there is no employeeContext at all', () => {
    const guard = new PermissionsGuard(makeReflector(['EMPLOYEE_DATA_MANAGE']));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow();
  });
});
