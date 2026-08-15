-- Phase3 17章「Unit単位のアクセス制御」を、目標確定後の継続支援ドメインの新規テーブルに適用する。
-- Step 0/自己分析Stepで確立したパターンを再利用する。
--
-- 【個人データ7テーブル】（goal_change_logs, actions, evidences, progress_entries, reflections,
--  goal_ai_insights, reminder_schedules）: 自己分析ドメインと同じ3層パターン
--   本人   : FOR ALL          — 自分の行のみ、読み書き全権限
--   UL     : FOR SELECT のみ  — 自Unit配下メンバーの行を閲覧のみ
--   ADMIN  : FOR SELECT のみ  — 全件を閲覧のみ（書き込みは本人のみ）
--
-- 【1on1系2テーブル】（one_on_one_prep_sheets, one_on_one_sessions）は上記と異なる主体構造を持つ
-- （employee_idは「対象メンバー」であって「行の所有者」ではない）。<one_on_one>要件どおり:
--   one_on_one_prep_sheets:
--     UL(unit_leader_id=自分)     : FOR ALL   — 自分が担当する1on1の準備シートを読み書き
--     ADMIN                        : FOR SELECT — 閲覧のみ
--     本人(employee_id=自分)       : アクセス不可（UL専用の準備資料、本人には非公開）
--   one_on_one_sessions:
--     UL(unit_leader_id=自分)     : FOR ALL   — 自分が担当する1on1の実施記録を読み書き
--     本人(employee_id=自分)       : FOR SELECT — 実施後の記録は閲覧可（透明性のため）
--     ADMIN                        : FOR SELECT — 閲覧のみ

ALTER TABLE "goal_change_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goal_change_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY goal_change_logs_self_all ON "goal_change_logs"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY goal_change_logs_ul_select_unit_scope ON "goal_change_logs"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "goal_change_logs"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY goal_change_logs_admin_select ON "goal_change_logs"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "actions" FORCE ROW LEVEL SECURITY;

CREATE POLICY actions_self_all ON "actions"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY actions_ul_select_unit_scope ON "actions"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "actions"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY actions_admin_select ON "actions"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "evidences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidences" FORCE ROW LEVEL SECURITY;

CREATE POLICY evidences_self_all ON "evidences"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY evidences_ul_select_unit_scope ON "evidences"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "evidences"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY evidences_admin_select ON "evidences"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "progress_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "progress_entries" FORCE ROW LEVEL SECURITY;

CREATE POLICY progress_entries_self_all ON "progress_entries"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY progress_entries_ul_select_unit_scope ON "progress_entries"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "progress_entries"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY progress_entries_admin_select ON "progress_entries"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "reflections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reflections" FORCE ROW LEVEL SECURITY;

CREATE POLICY reflections_self_all ON "reflections"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY reflections_ul_select_unit_scope ON "reflections"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "reflections"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY reflections_admin_select ON "reflections"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "goal_ai_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goal_ai_insights" FORCE ROW LEVEL SECURITY;

CREATE POLICY goal_ai_insights_self_all ON "goal_ai_insights"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY goal_ai_insights_ul_select_unit_scope ON "goal_ai_insights"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "goal_ai_insights"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY goal_ai_insights_admin_select ON "goal_ai_insights"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "reminder_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reminder_schedules" FORCE ROW LEVEL SECURITY;

CREATE POLICY reminder_schedules_self_all ON "reminder_schedules"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY reminder_schedules_ul_select_unit_scope ON "reminder_schedules"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "reminder_schedules"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY reminder_schedules_admin_select ON "reminder_schedules"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

-- 【one_on_one_prep_sheets】: UL専用の準備資料。本人(employee_id)には一切のポリシーを
-- 与えないことで、明示的にアクセス不可とする（<one_on_one>「AIは最終判断をしない」を、
-- 本人がバイアスなく1on1に臨めるようにする設計の一部）。
ALTER TABLE "one_on_one_prep_sheets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "one_on_one_prep_sheets" FORCE ROW LEVEL SECURITY;

CREATE POLICY one_on_one_prep_sheets_leader_all ON "one_on_one_prep_sheets"
  FOR ALL
  USING ("unit_leader_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("unit_leader_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY one_on_one_prep_sheets_admin_select ON "one_on_one_prep_sheets"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

-- 【one_on_one_sessions】: ULが読み書き、本人(対象メンバー)は実施後の記録を閲覧のみ。
ALTER TABLE "one_on_one_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "one_on_one_sessions" FORCE ROW LEVEL SECURITY;

CREATE POLICY one_on_one_sessions_leader_all ON "one_on_one_sessions"
  FOR ALL
  USING ("unit_leader_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("unit_leader_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY one_on_one_sessions_member_select ON "one_on_one_sessions"
  FOR SELECT
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY one_on_one_sessions_admin_select ON "one_on_one_sessions"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');
