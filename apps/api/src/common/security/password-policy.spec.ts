import { estimatePasswordStrength, validatePasswordPolicy } from './password-policy';

describe('validatePasswordPolicy', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePasswordPolicy('short1').valid).toBe(false);
    expect(validatePasswordPolicy('1234567').valid).toBe(false);
  });

  it('accepts an 8+ character alphanumeric-only password (no symbol required)', () => {
    expect(validatePasswordPolicy('abcd1234').valid).toBe(true);
    expect(validatePasswordPolicy('password').valid).toBe(true);
    expect(validatePasswordPolicy('12345678').valid).toBe(true);
  });

  it('accepts passwords using the allowed symbol set', () => {
    expect(validatePasswordPolicy('abcd1234!@#$').valid).toBe(true);
  });

  it('rejects disallowed characters (e.g. spaces, backticks)', () => {
    expect(validatePasswordPolicy('abcd 1234').valid).toBe(false);
    expect(validatePasswordPolicy('abcd`1234').valid).toBe(false);
  });

  it('rejects passwords over the max length', () => {
    expect(validatePasswordPolicy('a'.repeat(129)).valid).toBe(false);
  });
});

describe('estimatePasswordStrength', () => {
  it('rates below-minimum-length passwords as weak', () => {
    expect(estimatePasswordStrength('abc')).toBe('weak');
  });

  it('rates a long, varied password higher than a short simple one', () => {
    const weakish = estimatePasswordStrength('abcdefgh');
    const strong = estimatePasswordStrength('Abcd1234!@#$EfghIJKL');
    const order = ['weak', 'medium', 'strong', 'very_strong'];
    expect(order.indexOf(strong)).toBeGreaterThanOrEqual(order.indexOf(weakish));
  });
});
