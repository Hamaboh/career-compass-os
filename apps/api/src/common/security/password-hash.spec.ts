import { hashPassword, verifyPassword } from './password-hash';

describe('password-hash', () => {
  it('never stores the plaintext password in the hash output', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple1');
    expect(hash).not.toContain('CorrectHorseBatteryStaple1');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple1');
    await expect(verifyPassword(hash, 'CorrectHorseBatteryStaple1')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple1');
    await expect(verifyPassword(hash, 'WrongPassword')).resolves.toBe(false);
  });

  it('does not throw on a malformed hash, just returns false', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('SamePassword1');
    const b = await hashPassword('SamePassword1');
    expect(a).not.toBe(b);
  });
});
