# API契約仕様

## 1. Common

- Base: `/api/v1`
- Format: JSON UTF-8
- Contract: OpenAPIを外部契約の正とする
- Authentication: server-side session Cookie
- Mutation: CSRF token、Origin検証
- Concurrency: `version`またはETagによるoptimistic lock
- Pagination: cursor、`limit`は上限付き
- Trace: request/correlation ID
- Idempotency: 招待、通知、AI generation、重要mutationでkeyを受け付ける

## 2. Error envelope

fieldは`code`、`message`、`correlationId`、任意の`fieldErrors`、`retryable`、`retryAfter`。stack、SQL、secret、他userの存在を返さない。

主要code: `AUTH_INVALID_CREDENTIALS`、`ACCOUNT_NOT_ACTIVE`、`ACCOUNT_LOCKED_TEMPORARILY`、`INVITATION_INVALID_OR_EXPIRED`、`OTP_INVALID`、`OTP_ATTEMPTS_EXCEEDED`、`SESSION_EXPIRED`、`CSRF_INVALID`、`PERMISSION_DENIED`、`RESOURCE_NOT_FOUND`、`UNIT_SCOPE_DENIED`、`VERSION_CONFLICT`、`SMART_GATE_INCOMPLETE`、`GOAL_STATE_CONFLICT`、`POLICY_VERSION_IMMUTABLE`、`AI_UNAVAILABLE`、`AI_OUTPUT_INVALID`、`RATE_LIMITED`。

## 3. Authentication endpoints

| method/path | 認証 | 説明 |
|---|---|---|
| POST `/auth/invitations/{token}/otp` | invitation | OTP送信 |
| POST `/auth/invitations/{token}/otp/verify` | invitation | OTP検証 |
| POST `/auth/invitations/{token}/complete` | verified invitation | password設定・account有効化 |
| POST `/auth/login` | public | email＋password |
| POST `/auth/logout` | session | 現session失効 |
| POST `/auth/logout-all` | session | 全session失効 |
| GET `/auth/session` | session | actor・permission・scope取得 |
| POST `/auth/password-reset` | public | 存在を秘匿した申請 |
| POST `/auth/password-reset/complete` | reset token | password変更 |
| POST `/auth/password/change` | session | 現password確認後変更 |

## 4. ADMIN resources

- `/admin/employees`
- `/admin/units`
- `/admin/role-assignments`
- `/admin/invitations`
- `/admin/policy-documents`
- `/admin/policy-documents/{id}/versions`
- `/admin/evaluation-criteria`
- `/admin/kpis`
- `/admin/ul-missions`
- `/admin/settings`
- `/admin/ai-settings`
- `/admin/audit-logs`

重要操作はresourceの作成・参照・更新を分離し、制度公開、role変更、EXCLUDED化、招待取消には専用action endpointと明示確認を使用する。

## 5. Personal resources

- `/me/self-analysis/sessions`
- `/me/experiences`
- `/me/insights`
- `/me/values`
- `/me/skills`
- `/me/dreams`
- `/me/why-statements`
- `/me/career-directions`
- `/me/goals`
- `/me/goals/{id}/actions`
- `/me/goals/{id}/evidence`
- `/me/goals/{id}/checkins`
- `/me/goals/{id}/reflections`
- `/me/goals/{id}/smart-audits`
- `/me/goals/{id}/acceptance`
- `/me/goals/{id}/change-requests`
- `/me/one-on-ones`
- `/me/notifications`
- `/me/notification-preferences`

`/me`はrequestのemployee IDをbody/queryから受け取らず、session actorから導出する。

## 6. UL resources

- `/units/{unitId}/members`
- `/units/{unitId}/members/{employeeId}/support-summary`
- `/units/{unitId}/members/{employeeId}/shared-goals`
- `/units/{unitId}/one-on-ones`
- `/one-on-ones/{id}/agenda`
- `/one-on-ones/{id}/notes`
- `/one-on-ones/{id}/actions`
- `/one-on-ones/{id}/finalize`
- `/units/{unitId}/support-content`

すべてのrequestで有効なUL assignment、対象Member membership、resource visibilityを検査する。

## 7. AI endpoints

- POST `/ai/self-analysis/next-question`
- POST `/ai/dreams/explore`
- POST `/ai/why/explore`
- POST `/ai/goals/guide`
- POST `/ai/goals/{id}/smart-audit`
- POST `/ai/goals/{id}/next-actions`
- POST `/ai/one-on-ones/{id}/prepare`
- GET `/ai/runs/{id}`
- GET `/ai/proposals/{id}`
- POST `/ai/proposals/{id}/accept`
- POST `/ai/proposals/{id}/edit-and-accept`
- POST `/ai/proposals/{id}/reject`
- POST `/ai/proposals/{id}/defer`

AI generationはproposalだけを生成する。正式domain mutationはdecision endpointで人間actorを記録して行う。

## 8. Status codes

- 200/201/202/204: 成功
- 400: 構文・形式
- 401: 未認証
- 403: 認証済みだが禁止
- 404: 不存在またはscope外の存在秘匿
- 409: version・重複・状態競合
- 422: 業務rule
- 429: rate limit
- 503: mail/AI/queue等依存障害

## 9. Response minimization

employee responseにpassword、hash、token、内部lock情報を含めない。Member一覧に自己分析本文、夢・Why、AI raw responseを含めない。目的別DTOを使用し、汎用entity serializerで過剰fieldを返さない。
