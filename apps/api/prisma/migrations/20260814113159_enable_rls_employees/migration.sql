-- Phase3 17章「Unit単位のアクセス制御」。employeesテーブルにRow Level Securityを設定する。
--
-- セッション変数（PrismaService.withRlsContext が SET LOCAL で設定する）:
--   app.emp_role              : 'ADMIN' | 'UL' | 'MEMBER' | 'EXCLUDED' | ''（未設定）
--   app.current_employee_id  : uuid
--   app.current_unit_id      : uuid（所属Unitがない場合はダミーUUIDが入る。実データとは一致しない）
--
-- 注意（2026-08-14修正）: 変数名は当初 `app.current_role` だったが、`CURRENT_ROLE` はPostgreSQLの
-- 予約語（CURRENT_USER相当の組込み関数）であり、SET文のパラメータ名としてドット修飾しても
-- 構文エラー（42601: syntax error at or near "current_role"）になることが実機テストで判明した。
-- 予約語と衝突しない `app.emp_role` に変更した。
--
-- ロールごとの可視範囲（Phase3 7.1/7.3節のRBAC権限フラグと対応）:
--   ADMIN  : UNIT_SCOPE_ALL により全件（読み書きとも）
--   UL     : UNIT_SCOPE_OWN により自Unit配下 + 自分自身の行を閲覧のみ（EMPLOYEE_DATA_MANAGEを
--            持たないため書き込みは許可しない）
--   MEMBER : 自分自身の行を閲覧のみ（SELF_DATA_VIEW）
--
-- 書き込み（招待発行・在籍状態変更等）はADMINのみが行い、PermissionGuardのEMPLOYEE_DATA_MANAGE
-- チェックと、本ポリシーの「ADMINのみFOR ALL」の二重で強制する。
-- パスワード設定・変更（employees.password_hash）は認証フロー専用の内部処理であり、
-- 一般のRBAC/RLSではなく PrismaService.withSystemBypass() 経由で行う（コード側の設計として
-- 明示し、通常のController→Guardの経路からは到達できないようにする）。

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
-- テーブル所有者(app_backend)自身にもポリシーを適用する。適用しないと所有者は既定でRLSをバイパスしてしまう。
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;

CREATE POLICY employees_admin_all ON "employees"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');

CREATE POLICY employees_ul_select_unit_scope ON "employees"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND (
      "unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
      OR "id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid
    )
  );

CREATE POLICY employees_self_select ON "employees"
  FOR SELECT
  USING ("id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);
