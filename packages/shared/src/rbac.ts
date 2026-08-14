/**
 * Phase3 7章「RBAC」。
 *
 * 要件どおり、「アプリそのものの編集」（APP_MANAGEMENT/APP_SETTINGS_EDIT等）と
 * 「自分自身のデータ編集」（SELF_DATA_EDIT）と「他者データへの支援操作」（APP_EDIT）は
 * 互いに独立したフラグとして定義する（同一視しない）。
 *
 * `role` は4値の固定enumであり、権限自体はコード側（NestJS Guard実装）にハードコードする
 * （Phase3 3章: 可変長roles/permissionsテーブルは1〜10人規模には過剰設計と判断し不採用）。
 * Phase4 10.1節の訂正: 現行モデルではADMINロールは全ての管理系フラグを一律に持つ
 * （フラグを部分的にしか持たないAdminアカウントという状態はまだ存在しない）。
 *
 * このマッピングを変更することはPhase3の確定仕様（DB/権限モデル）を変更することを意味する。
 * 変更が必要になった場合は docs/DESIGN_FREEZE.md ルール2 に従い、実装前に報告する。
 */
export const EMPLOYEE_ROLES = ['ADMIN', 'UL', 'MEMBER', 'EXCLUDED'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const PERMISSION_FLAGS = [
  'LOGIN',
  'APP_MANAGEMENT',
  'APP_SETTINGS_EDIT',
  'EMPLOYEE_DATA_MANAGE',
  'COMPANY_POLICY_MANAGE',
  'USER_ROLE_MANAGE',
  'UNIT_SCOPE_ALL',
  'APP_EDIT',
  'UNIT_SCOPE_OWN',
  'SELF_DATA_EDIT',
  'SELF_DATA_VIEW',
] as const;
export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

/** Phase3 7.1表の●列をそのままロールごとの集合に変換したもの。 */
export const ROLE_PERMISSIONS: Record<EmployeeRole, readonly PermissionFlag[]> = {
  ADMIN: [
    'LOGIN',
    'APP_MANAGEMENT',
    'APP_SETTINGS_EDIT',
    'EMPLOYEE_DATA_MANAGE',
    'COMPANY_POLICY_MANAGE',
    'USER_ROLE_MANAGE',
    'UNIT_SCOPE_ALL', // UNIT_SCOPE_OWNを上書きするため付与しない
    'APP_EDIT',
    'SELF_DATA_EDIT',
    'SELF_DATA_VIEW',
  ],
  UL: ['LOGIN', 'APP_EDIT', 'UNIT_SCOPE_OWN', 'SELF_DATA_EDIT', 'SELF_DATA_VIEW'],
  MEMBER: ['LOGIN', 'SELF_DATA_EDIT', 'SELF_DATA_VIEW'],
  EXCLUDED: [],
};

export function hasPermission(role: EmployeeRole, flag: PermissionFlag): boolean {
  return ROLE_PERMISSIONS[role].includes(flag);
}

/**
 * Phase3 7.3節: audit_logs の閲覧は APP_MANAGEMENT で保護される（ADMIN限定）。
 * Phase4 10.1節で訂正済みの通り、独立した「監査ログ閲覧権限」フラグは存在しない。
 */
export function canViewAuditLogs(role: EmployeeRole): boolean {
  return hasPermission(role, 'APP_MANAGEMENT');
}
