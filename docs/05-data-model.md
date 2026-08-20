# 論理データモデル・データ辞書

## 1. Naming and common columns

物理名は`snake_case`、IDはUUID系、日時はUTC。業務tableは必要に応じ`organization_id`、`created_at`、`updated_at`、`created_by`、`updated_by`、`version`、`data_classification`、`visibility_scope`を持つ。soft deleteは復元要件のあるaggregate rootだけに限定する。

## 2. Organization and identity

| table | 主要field | 制約 |
|---|---|---|
| `organizations` | name, status | tenant境界 |
| `units` | organization_id, code, name, type, parent_unit_id, status | code unique/org |
| `employees` | employee_no, display_name, email, normalized_email, job_title, employment_status | email・employee_no unique/org |
| `unit_memberships` | employee_id, unit_id, membership_type, valid_from, valid_to | 有効期間重複を検証 |
| `user_accounts` | employee_id, status, password_hash, changed_at, failed_count, locked_until | active account最大1 |
| `roles` | code, name | ADMIN/UL/MEMBER/EXCLUDED |
| `permissions` | code, description | 原子的権限 |
| `role_permissions` | role_id, permission_id | unique pair |
| `role_assignments` | employee_id, role_id, unit_id?, valid_from, valid_to | scope付き |
| `employee_status_history` | old_status, new_status, reason, actor | immutable |

## 3. Authentication

| table | 主要field | 制約 |
|---|---|---|
| `invitations` | employee_id, email_snapshot, token_hash, status, expires_at, consumed_at, invited_by | 単回利用 |
| `otp_challenges` | purpose, invitation_id?, reset_id?, code_hash, expires_at, attempts, max_attempts, consumed_at | active challenge制御 |
| `sessions` | account_id, session_hash, idle_expires_at, absolute_expires_at, revoked_at, last_seen_at | 秘密平文禁止 |
| `password_reset_requests` | account_id, token_hash, expires_at, consumed_at | 単回 |
| `authentication_events` | account_id?, type, outcome, reason_code, occurred_at | 秘密値なし |

## 4. Company policy

| table | 主要field | 制約 |
|---|---|---|
| `policy_documents` | type, title, status | 論理identity |
| `policy_versions` | document_id, version_no, effective_from/to, status, storage_object_id, checksum, approved_by | 公開後immutable |
| `policy_target_scopes` | version_id, unit_id?, job_title?, role? | 適用scope |
| `evaluation_criteria` | version_id, code, name, description, measurement, weight? | version内unique |
| `kpis` | version_id, code, name, description, achievement_rule, period | 過去参照保持 |
| `competencies` | code, name, category | 共通能力 |
| `kpi_competencies` | kpi_id, competency_id | unique pair |
| `ul_missions` | version_id, code, title, purpose, success_criteria | UL制度 |
| `ul_mission_scopes` | mission_id, unit_id?, job_title? | 適用scope |
| `storage_objects` | object_key, name, mime, size, checksum, scan_status | 本体はDB外 |

## 5. Self analysis and career

| table | 主要field |
|---|---|
| `self_analysis_sessions` | employee_id, topic, status, started/completed, visibility |
| `self_analysis_questions` | session_id, type, text_snapshot, sequence, generated_by |
| `self_analysis_responses` | question_id, employee_id, response_text, provenance, visibility |
| `experiences` | employee_id, situation, action, result, emotion, occurred_on, visibility |
| `insights` | employee_id, type, label, description, provenance, confirmation_status |
| `insight_evidence_links` | insight_id, experience_id/response_id |
| `values` | employee_id, label, description, status |
| `skills` | organization_id?, code?, name, category |
| `employee_skills` | employee_id, skill_id, self_level, evidence_state |
| `dreams` | employee_id, title, description, state, confidence, visibility |
| `dream_revisions` | dream_id, version_no, snapshot, reason |
| `career_directions` | employee_id, title, description, state, horizon |
| `why_statements` | employee_id, text, provenance, confirmation_status, satisfaction |
| `why_experience_links` | why_id, experience_id |
| `why_value_links` | why_id, value_id |
| `why_dream_links` | why_id, dream_id |

主要対象の根拠linkは明示join tableとし、制約のない多相JSONだけに依存しない。

## 6. Goals

| table | 主要field |
|---|---|
| `goals` | employee_id, type, title, status, start_date, due_date, current_revision_id |
| `goal_revisions` | goal_id, revision_no, snapshot, change_reason, created_by |
| `goal_relations` | parent_goal_id, child_goal_id, relation_type |
| `goal_why_links` | goal_id, why_id, relation_type, confirmation_status |
| `goal_dream_links` | goal_id, dream_id, relation_type |
| `goal_career_links` | goal_id, career_direction_id |
| `goal_kpi_links` | goal_id, kpi_id, relation_type, explanation, confirmed_by |
| `goal_mission_links` | goal_id, mission_id, relation_type |
| `action_items` | goal_id, owner_id, title, status, due_at, completed_at |
| `evidence` | goal_id, employee_id, type, description, storage_object_id?, visibility, verification_status |
| `progress_checkins` | goal_id, employee_id, state, self_assessment, blockers, next_action, checked_at |
| `reflections` | goal_id, employee_id, outcome, learning, next_change, visibility |
| `smart_audits` | goal_revision_id, overall_state, audited_at, source |
| `smart_audit_items` | audit_id, dimension, verdict, reason, missing_info, exception_reason |
| `goal_acceptances` | goal_revision_id, employee_id, acceptance_checks, accepted_at |
| `goal_change_requests` | goal_id, proposed_changes, reason, state, proposed_by |
| `satisfaction_measurements` | employee_id, subject_type, subject_id, metric, value, reason |

goal relationは自己参照・循環を禁止する。公開済みrevisionはimmutable。goal確定にはSMART auditとacceptanceを同一transactionで関連付ける。

## 7. One-on-one, AI, notification, audit

| table | 主要field |
|---|---|
| `one_on_ones` | unit_id, member_id, leader_id, scheduled_at, occurred_at, status |
| `one_on_one_agenda_items` | one_on_one_id, source, topic, priority, visibility |
| `one_on_one_notes` | one_on_one_id, author_id, body, visibility |
| `one_on_one_actions` | one_on_one_id, owner_id, action, due_at, status |
| `one_on_one_goal_links` | one_on_one_id, goal_id |
| `reminder_plans` | employee_id, subject_type/id, rule, next_at, enabled |
| `notifications` | recipient_id, type, template_data, state, scheduled/sent_at |
| `notification_preferences` | employee_id, channel, quiet_hours, frequency |
| `ai_prompts` | agent_type, version, template_hash, status |
| `ai_runs` | employee_id, agent_type, prompt_version_id, model, status, policy_version |
| `ai_context_items` | ai_run_id, source_type/id, redaction_state, content_hash |
| `ai_outputs` | ai_run_id, output_type, structured_output, safety_state |
| `ai_proposals` | output_id, target_type/id?, proposal, rationale, confidence_band, state |
| `ai_decisions` | proposal_id, actor_id, decision, edited_value?, reason, decided_at |
| `audit_logs` | actor_id?, action, resource_type/id?, outcome, scope, correlation_id, metadata_safe |

## 8. State vocabularies

- account: INVITED, ACTIVE, TEMP_LOCKED, ADMIN_LOCKED, EXCLUDED, DEACTIVATED
- goal: DRAFT, WHY_IN_PROGRESS, SMART_IN_PROGRESS, REVIEW, CONFIRMED, ACTIVE, AT_RISK, REVISION_PENDING, ACHIEVED, PARTIALLY_ACHIEVED, PAUSED, ABANDONED, ARCHIVED
- dream: UNEXPLORED, EXPLORING, HYPOTHESIS, TESTING, TENTATIVE, CONFIRMED, RECONSIDERING, WITHDRAWN
- proposal: GENERATED, PENDING, ACCEPTED, EDITED_ACCEPTED, REJECTED, DEFERRED, EXPIRED
- policy version: DRAFT, IN_REVIEW, SCHEDULED, ACTIVE, ENDED, ARCHIVED
- invitation: CREATED, SENT, OPENED, OTP_PENDING, OTP_VERIFIED, PASSWORD_PENDING, COMPLETED, EXPIRED, REVOKED, SUPERSEDED

## 9. Transaction boundaries

- invitation消費＋account有効化＋role割当
- OTP成功＋challenge消費
- password変更＋session全失効
- goal revision＋SMART audit＋acceptance＋current更新
- policy公開＋旧version終了
- AI proposal decision＋正式draft作成
