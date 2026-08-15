-- Phase3 17章「Unit単位のアクセス制御」を、MVP完成フェーズの新規テーブルに適用する。
--
-- 【notifications】: 既存の3層パターン(自己分析等)や1on1系の2層パターンとも異なる、
-- 本テーブル固有の2ポリシー構成（design freezeルール1「軽微な変更」として理由を明示する）。
-- notificationsは本人の反省的データ（自己分析・Why・振り返り本文等）ではなく、
-- 「システムが本人に配信する通知」という性質のレコードである。配信元はHTTPリクエストの
-- 主体（本人）ではなく、BullMQバックグラウンドワーカー（ReminderScheduleの期限到来を
-- スイープして通知を生成する）であるため、本人のRLSコンテキストでのINSERTが構造的に
-- 成立しない（本人が能動的に自分宛て通知を作成する操作は存在しない）。
--   本人(recipient_employee_id=自分) : FOR SELECT, FOR UPDATE — 閲覧・既読化のみ
--                                       （作成・削除は本人操作としては発生しない）
--   ADMIN                            : FOR ALL — withSystemBypass()経由のワーカーが
--                                       任意の受信者宛てに生成するための書き込み経路。
--                                       Postgresロールを分離しない現行アーキテクチャ
--                                       （app_backend単一ロール、アプリ層でrole切替）の
--                                       制約下での実装判断。
--
-- 【evaluation_period_master / competency_master / position_master】:
-- kpi_master/ulm_masterと同じ「全社共通マスタ」カテゴリのため、既存パターンをそのまま再利用する。
--   認証済み全員 : FOR SELECT
--   ADMIN         : FOR ALL（実際の書き込みはCOMPANY_POLICY_MANAGE権限を持つADMINのみ、
--                   APIレベルのRequirePermissionで強制。RLSはさらに上乗せの防御層）
--
-- 【app_settings】: 同じく全社共通の設定値。kpi_master等と同一パターンを適用する。
--   認証済み全員 : FOR SELECT
--   ADMIN         : FOR ALL（実際の書き込みはAPP_SETTINGS_EDIT権限で強制）

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

CREATE POLICY notifications_self_select ON "notifications"
  FOR SELECT
  USING ("recipient_employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY notifications_self_update ON "notifications"
  FOR UPDATE
  USING ("recipient_employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid)
  WITH CHECK ("recipient_employee_id" = NULLIF(current_setting('app.current_employee_id', true), '')::uuid);

CREATE POLICY notifications_admin_all ON "notifications"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "evaluation_period_master" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evaluation_period_master" FORCE ROW LEVEL SECURITY;

CREATE POLICY evaluation_period_master_authenticated_select ON "evaluation_period_master"
  FOR SELECT
  USING (current_setting('app.emp_role', true) <> '');

CREATE POLICY evaluation_period_master_admin_all ON "evaluation_period_master"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "competency_master" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competency_master" FORCE ROW LEVEL SECURITY;

CREATE POLICY competency_master_authenticated_select ON "competency_master"
  FOR SELECT
  USING (current_setting('app.emp_role', true) <> '');

CREATE POLICY competency_master_admin_all ON "competency_master"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "position_master" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "position_master" FORCE ROW LEVEL SECURITY;

CREATE POLICY position_master_authenticated_select ON "position_master"
  FOR SELECT
  USING (current_setting('app.emp_role', true) <> '');

CREATE POLICY position_master_admin_all ON "position_master"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');

ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_settings" FORCE ROW LEVEL SECURITY;

CREATE POLICY app_settings_authenticated_select ON "app_settings"
  FOR SELECT
  USING (current_setting('app.emp_role', true) <> '');

CREATE POLICY app_settings_admin_all ON "app_settings"
  FOR ALL
  USING (current_setting('app.emp_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.emp_role', true) = 'ADMIN');
