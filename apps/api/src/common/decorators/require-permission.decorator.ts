import { SetMetadata } from '@nestjs/common';
import type { PermissionFlag } from '@career-compass/shared';

/** Phase3 7.4節 PermissionGuard: ルートに宣言された権限フラグをrequest元が満たすかを検証する。 */
export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const RequirePermission = (...flags: PermissionFlag[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, flags);
