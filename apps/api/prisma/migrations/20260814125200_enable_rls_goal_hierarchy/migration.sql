-- Phase3 17章「Unit単位のアクセス制御」を、自己分析〜目標形成ドメインの新規テーブルに適用する。
-- Step 0で確立したセッション変数・パターンをそのまま再利用する（20260814113159_enable_rls_employees参照）。
--
-- セッション変数（PrismaService.withRlsContext が SET LOCAL で設定する）:
--   app.emp_role              : 'ADMIN' | 'UL' | 'MEMBER' | 'EXCLUDED' | ''（未設定）
--   app.current_employee_id  : uuid
--   app.current_unit_id      : uuid（所属Unitがない場合はダミーUUIDが入る。実データとは一致しない）
--
-- 【個人の内省データ11テーブル】（self_analysis_*, dream_hypotheses, visions, why_records,
--  directions, long_term_goals, checkpoints, institutional_connections, goal_candidates）:
-- 本人の自己分析・夢・Why・目標は極めて機微な個人データであり、<constraints>「個人データを
-- 他ユーザーに漏らさない」を構造的に担保する。ADMIN/ULであっても他者の内省データへの
-- 書き込みは一切許可しない（読み取りのみ、Phase3 7.1 UNIT_SCOPE_ALL/UNIT_SCOPE_OWNは
-- 「閲覧」の範囲を規定するものであり、書き込み権限EMPLOYEE_DATA_MANAGEとは独立している）。
--   本人   : FOR ALL          — 自分の行のみ、読み書き全権限
--   UL     : FOR SELECT のみ  — 自Unit配下メンバーの行を閲覧のみ（自分自身の行はself policyでカバー）
--   ADMIN  : FOR SELECT のみ  — 全件を閲覧のみ（UNIT_SCOPE_ALL、書き込みは本人のみ）
--
-- dream_hypothesis_revision_logs はアプリ内部の変更履歴ログであり、self_analysis_answers等と
-- 同様に個人に紐づくが employee_id列を持たない（dream_hypothesis_id経由の間接参照のため）。
-- RLSではなくアプリケーション層（DreamServiceが常にemployeeIdスコープでクエリする）で
-- アクセス制御する。将来的にRLSが必要になった場合は employee_id を非正規化して追加する。

ALTER TABLE "self_analysis_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "self_analysis_sessions" FORCE ROW LEVEL SECURITY;

CREATE POLICY self_analysis_sessions_self_all ON "self_analysis_sessions"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY self_analysis_sessions_ul_select_unit_scope ON "self_analysis_sessions"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "self_analysis_sessions"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY self_analysis_sessions_admin_select ON "self_analysis_sessions"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "self_analysis_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "self_analysis_answers" FORCE ROW LEVEL SECURITY;

CREATE POLICY self_analysis_answers_self_all ON "self_analysis_answers"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY self_analysis_answers_ul_select_unit_scope ON "self_analysis_answers"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "self_analysis_answers"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY self_analysis_answers_admin_select ON "self_analysis_answers"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "self_analysis_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "self_analysis_insights" FORCE ROW LEVEL SECURITY;

CREATE POLICY self_analysis_insights_self_all ON "self_analysis_insights"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY self_analysis_insights_ul_select_unit_scope ON "self_analysis_insights"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "self_analysis_insights"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY self_analysis_insights_admin_select ON "self_analysis_insights"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "dream_hypotheses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dream_hypotheses" FORCE ROW LEVEL SECURITY;

CREATE POLICY dream_hypotheses_self_all ON "dream_hypotheses"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY dream_hypotheses_ul_select_unit_scope ON "dream_hypotheses"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "dream_hypotheses"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY dream_hypotheses_admin_select ON "dream_hypotheses"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "visions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visions" FORCE ROW LEVEL SECURITY;

CREATE POLICY visions_self_all ON "visions"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY visions_ul_select_unit_scope ON "visions"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "visions"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY visions_admin_select ON "visions"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "why_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "why_records" FORCE ROW LEVEL SECURITY;

CREATE POLICY why_records_self_all ON "why_records"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY why_records_ul_select_unit_scope ON "why_records"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "why_records"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY why_records_admin_select ON "why_records"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "directions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "directions" FORCE ROW LEVEL SECURITY;

CREATE POLICY directions_self_all ON "directions"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY directions_ul_select_unit_scope ON "directions"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "directions"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY directions_admin_select ON "directions"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "long_term_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "long_term_goals" FORCE ROW LEVEL SECURITY;

CREATE POLICY long_term_goals_self_all ON "long_term_goals"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY long_term_goals_ul_select_unit_scope ON "long_term_goals"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "long_term_goals"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY long_term_goals_admin_select ON "long_term_goals"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "checkpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checkpoints" FORCE ROW LEVEL SECURITY;

CREATE POLICY checkpoints_self_all ON "checkpoints"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY checkpoints_ul_select_unit_scope ON "checkpoints"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "checkpoints"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY checkpoints_admin_select ON "checkpoints"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "institutional_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "institutional_connections" FORCE ROW LEVEL SECURITY;

CREATE POLICY institutional_connections_self_all ON "institutional_connections"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY institutional_connections_ul_select_unit_scope ON "institutional_connections"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "institutional_connections"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY institutional_connections_admin_select ON "institutional_connections"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "goal_candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goal_candidates" FORCE ROW LEVEL SECURITY;

CREATE POLICY goal_candidates_self_all ON "goal_candidates"
  FOR ALL
  USING ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY goal_candidates_ul_select_unit_scope ON "goal_candidates"
  FOR SELECT
  USING (
    current_setting('app.emp_role', true) = 'UL'
    AND EXISTS (
      SELECT 1 FROM "employees" e
      WHERE e."id" = "goal_candidates"."employee_id"
        AND e."unit_id" = NULLIF(current_setting('app.current_unit_id', true), '')::uuid
    )
  );

CREATE POLICY goal_candidates_admin_select ON "goal_candidates"
  FOR SELECT
  USING (current_setting('app.emp_role', true) = 'ADMIN');

-- 【会社KPI/ULMマスタ】: 個人データではなく組織の参照情報。全認証済み従業員が閲覧可能、
-- 書き込みはADMINのみ（PermissionsGuardのCOMPANY_POLICY_MANAGEチェックと二重で強制する）。
ALTER TABLE "kpi_master" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kpi_master" FORCE ROW LEVEL SECURITY;

CREATE POLICY kpi_master_admin_all ON "kpi_master"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');

CREATE POLICY kpi_master_authenticated_select ON "kpi_master"
  FOR SELECT
  USING (current_setting('app.emp_role', true) <> '');

ALTER TABLE "ulm_master" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ulm_master" FORCE ROW LEVEL SECURITY;

CREATE POLICY ulm_master_admin_all ON "ulm_master"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');

CREATE POLICY ulm_master_authenticated_select ON "ulm_master"
  FOR SELECT
  USING (current_setting('app.emp_role', true) <> '');

-- 【AI呼び出しログ】: Phase3 14.5節、ADMINのエンジニアリング担当に限定（本人にもUL閲覧にも開放しない）。
ALTER TABLE "ai_call_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_call_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_call_logs_admin_all ON "ai_call_logs"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');
