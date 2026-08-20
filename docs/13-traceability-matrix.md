# 要件トレーサビリティ

## 1. Core matrix

| 要件 | Domain/DB | API | UI | Test |
|---|---|---|---|---|
| 招待対象だけ登録 | invitation/account | auth invitation | AU-02〜05 | E2E招待、token再利用 |
| 初回OTP | otp_challenges | OTP send/verify | AU-03 | 期限、試行、再送 |
| 通常loginはpasswordのみ | account/session | login | AU-01 | OTP不要login |
| ADMIN/UL/MEMBER/EXCLUDED | role/permission/assignment | Guard/policy | workspace別 | RBAC matrix |
| ULは自Unitのみ | membership、RLS | Unit resources | UL-02〜13 | cross-unit negative |
| Memberは自己data編集 | owner＋visibility | `/me/*` | ME screens | IDOR negative |
| ULは社員管理不可 | permission | admin employee拒否 | UI非表示 | UL employee update拒否 |
| 制度version | policy/version/KPI/Mission | admin policy | AD-08〜12 | 過去goal不変 |
| 自己分析 | session/question/response/insight | `/me/self-analysis` | ME-04〜06 | dynamic flow、scope |
| 夢なし対応 | dreams state | dream explore | ME-07〜09 | 夢なしjourney |
| Whyと根拠 | why/link tables | why endpoints | ME-10 | provenance・本人確認 |
| 目標階層 | goal/relation/link | goal resources | ME-12〜17 | 循環禁止、revision |
| KPI非接続許容 | optional goal_kpi_link | goal mapping | goal review | 非接続E2E |
| SMART誘導・gate | audit/items/acceptance | smart endpoints | ME-15/16 | 不足・例外 |
| 行動・証拠 | action/evidence | nested resources | ME-18/20 | owner、upload |
| 継続支援 | checkin/reflection/reminder | progress/reminder | ME-19/21/26 | 周期・抑制 |
| 1on1 | one_on_one tables | UL/member resources | ME-23〜25、UL-05〜09 | end-to-end、訂正 |
| AI提案と確定分離 | run/output/proposal/decision | AI decision endpoints | AI card | 無承認反映拒否 |
| 機微情報共有 | visibility＋RLS | purpose policy | share selector | UL非共有拒否 |
| 監査 | audit_logs | admin audit | AD-16/17 | 秘密非記録 |
| AI障害fallback | run status | 503/fallback | error UX | AI timeout E2E |

## 2. Security traceability

| control | 実装場所 | verification |
|---|---|---|
| Argon2id | Auth service | hash unit/integration、log scan |
| HttpOnly session | Auth/API | browser E2E |
| CSRF | middleware/Guard | mutation negative |
| XSS/CSP | Web/headers | security E2E |
| SQL injection | ORM/query review | malicious input |
| Rate limit | API/Redis | threshold tests |
| Unit isolation | Guard＋RLS | matrix＋DB negative |
| Secret redaction | logger/audit | automated log assertion |
| AI context scope | Context Builder | fixed evaluation cases |
| File scan | upload workflow | malicious fixture |

## 3. Change rule

要件を追加・変更する場合は、Phase文書、data/API/RBAC/UI、test、matrixを同じ変更で更新する。matrixに実装・testがない要件は未完了とする。
