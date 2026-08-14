import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import { CsrfGuard } from './csrf.guard';

function makeContext(
  method: string,
  cookies: Record<string, string>,
  headers: Record<string, string>,
): ExecutionContext {
  const request = {
    method,
    cookies,
    header: (name: string) => headers[name.toLowerCase()],
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
  } as unknown as ExecutionContext;
}

function makeReflector(isPublic: boolean | undefined): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector;
}

function makeConfig(): ConfigService {
  return { getOrThrow: (key: string) => (key === 'CSRF_COOKIE_NAME' ? 'csrf_token' : key) } as unknown as ConfigService;
}

describe('CsrfGuard', () => {
  it('allows safe methods (GET) without a CSRF token', () => {
    const guard = new CsrfGuard(makeReflector(false), makeConfig());
    expect(guard.canActivate(makeContext('GET', {}, {}))).toBe(true);
  });

  it('allows @Public() routes regardless of method', () => {
    const guard = new CsrfGuard(makeReflector(true), makeConfig());
    expect(guard.canActivate(makeContext('POST', {}, {}))).toBe(true);
  });

  it('rejects a POST with no CSRF cookie/header at all', () => {
    const guard = new CsrfGuard(makeReflector(false), makeConfig());
    expect(() => guard.canActivate(makeContext('POST', {}, {}))).toThrow();
  });

  it('rejects a POST where the header does not match the cookie', () => {
    const guard = new CsrfGuard(makeReflector(false), makeConfig());
    const ctx = makeContext('POST', { csrf_token: 'abc' }, { 'x-csrf-token': 'def' });
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('allows a POST where the header matches the cookie', () => {
    const guard = new CsrfGuard(makeReflector(false), makeConfig());
    const ctx = makeContext('POST', { csrf_token: 'abc' }, { 'x-csrf-token': 'abc' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
