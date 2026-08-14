import { generateOpaqueToken, generateOtp, hashToken, safeCompareHex } from './tokens';

describe('tokens', () => {
  it('generateOpaqueToken produces unique, sufficiently long tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32); // base64url of 32 bytes
  });

  it('hashToken is deterministic and never returns the raw input', () => {
    const raw = 'my-raw-token';
    const h1 = hashToken(raw);
    const h2 = hashToken(raw);
    expect(h1).toBe(h2);
    expect(h1).not.toContain(raw);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('safeCompareHex matches equal hashes and rejects different ones', () => {
    const h1 = hashToken('a');
    const h2 = hashToken('a');
    const h3 = hashToken('b');
    expect(safeCompareHex(h1, h2)).toBe(true);
    expect(safeCompareHex(h1, h3)).toBe(false);
  });

  it('safeCompareHex rejects mismatched lengths without throwing', () => {
    expect(safeCompareHex('ab', 'abcd')).toBe(false);
  });

  it('generateOtp always returns a zero-padded 6-digit string', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });
});
