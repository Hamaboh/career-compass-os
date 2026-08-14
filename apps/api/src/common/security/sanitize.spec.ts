import { assertOneOf, assertUuid } from './sanitize';

describe('sanitize (RLS SET LOCAL guard rails)', () => {
  describe('assertUuid', () => {
    it('accepts a well-formed UUID', () => {
      expect(assertUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });

    it('rejects a SQL-injection-shaped string', () => {
      expect(() => assertUuid("'; DROP TABLE employees; --")).toThrow();
    });

    it('rejects a non-UUID string', () => {
      expect(() => assertUuid('not-a-uuid')).toThrow();
    });
  });

  describe('assertOneOf', () => {
    const ROLES = ['ADMIN', 'UL', 'MEMBER', 'EXCLUDED'] as const;

    it('accepts a value present in the allow-list', () => {
      expect(assertOneOf('ADMIN', ROLES)).toBe('ADMIN');
    });

    it('rejects a value not in the allow-list, including injection attempts', () => {
      expect(() => assertOneOf("ADMIN'; --", ROLES)).toThrow();
      expect(() => assertOneOf('SUPERUSER', ROLES)).toThrow();
    });
  });
});
