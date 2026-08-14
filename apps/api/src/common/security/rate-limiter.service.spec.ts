import { RateLimiterService } from './rate-limiter.service';

function createMockRedis() {
  const store = new Map<string, { value: number; expiresAt?: number }>();
  return {
    incr: jest.fn(async (key: string) => {
      const entry = store.get(key) ?? { value: 0 };
      entry.value += 1;
      store.set(key, entry);
      return entry.value;
    }),
    expire: jest.fn(async () => 1),
    ttl: jest.fn(async () => 60),
    set: jest.fn(async (key: string, _value: string, _ex: string, _seconds: number, nx: string) => {
      if (nx === 'NX' && store.has(key)) return null;
      store.set(key, { value: 1 });
      return 'OK';
    }),
  };
}

describe('RateLimiterService', () => {
  it('allows requests under the limit and decrements remaining', async () => {
    const redis = createMockRedis();
    const service = new RateLimiterService(redis as never);

    const r1 = await service.consume('k', 60, 3);
    expect(r1).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });

    const r2 = await service.consume('k', 60, 3);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it('denies once the count exceeds max', async () => {
    const redis = createMockRedis();
    const service = new RateLimiterService(redis as never);

    await service.consume('k', 60, 2);
    await service.consume('k', 60, 2);
    const third = await service.consume('k', 60, 2);

    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('sets the TTL only on the first increment (fixed window)', async () => {
    const redis = createMockRedis();
    const service = new RateLimiterService(redis as never);

    await service.consume('k', 60, 5);
    await service.consume('k', 60, 5);

    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  it('checkCooldown allows exactly once within the window then denies', async () => {
    const redis = createMockRedis();
    const service = new RateLimiterService(redis as never);

    const first = await service.checkCooldown('otp-send:abc', 60);
    expect(first.allowed).toBe(true);

    const second = await service.checkCooldown('otp-send:abc', 60);
    expect(second.allowed).toBe(false);
  });
});
