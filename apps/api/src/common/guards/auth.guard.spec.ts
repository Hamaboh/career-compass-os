import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

function makeContext(employeeContext: { employeeId: string } | undefined): ExecutionContext {
  const request = { employeeContext };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
  } as unknown as ExecutionContext;
}

function makeReflector(isPublic: boolean | undefined): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector;
}

describe('AuthGuard', () => {
  it('always allows @Public() routes, even without a session', () => {
    const guard = new AuthGuard(makeReflector(true));
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('allows a request with a valid employeeContext', () => {
    const guard = new AuthGuard(makeReflector(false));
    expect(guard.canActivate(makeContext({ employeeId: 'e1' }))).toBe(true);
  });

  it('throws for a non-public route without an employeeContext', () => {
    const guard = new AuthGuard(makeReflector(false));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow();
  });

  it('throws when employeeContext exists but employeeId is empty (unauthenticated placeholder)', () => {
    const guard = new AuthGuard(makeReflector(false));
    expect(() => guard.canActivate(makeContext({ employeeId: '' }))).toThrow();
  });
});
