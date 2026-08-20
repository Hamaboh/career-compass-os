# 実装ロードマップ

## Phase 0: Repository foundation

### Scope

monorepo、Node/package manager固定、TypeScript、Next.js、NestJS、shared contract、format/lint/typecheck/test、OpenAPI、Docker Compose、PostgreSQL、Redis、storage、environment validation、structured logging、CI。

### DoD

clean install、dev起動、health、format、lint、typecheck、unit、build、empty migration、secret scanが成功する。

## Phase 1: Identity, DB, Authentication, Authorization

Organization、Employee、Unit、membership、Role、Permission、account、invitation、OTP、password、session、reset、lock、audit、Guard、Unit scope、ownership、RLS。

DoDは招待E2E、通常login、reset、EXCLUDED、cross-unit、IDOR、secret非出力、migration/rollback。

## Phase 2: Company policy and ADMIN

制度document/version、criteria、KPI、competency、UL Mission、scope、file、社員・Unit・role・招待管理UI。公開version immutableと旧goal参照をtestする。

## Phase 3: Self analysis and career

Experience、self-analysis、dynamic question、response、insight、value、skill、dream、Why、career direction、sharing、AI proposal/decision/provenance。AIなしfallbackと非共有情報隔離を必須とする。

## Phase 4: Goal formation and SMART

Goal hierarchy、revision、Why/Dream/Career/KPI/Mission link、wizard、SMART guidance/audit/exception、acceptance、action、evidence。本人承認なし確定不可。

## Phase 5: Continuous support

Progress、reflection、goal revision、satisfaction、next action、reminder、notification。入力なしを停滞と断定しない。

## Phase 6: One-on-one and UL

Member prep、AI prep、UL question review、record、summary draft、Member correction、UL action、support queue、Unit status。ranking禁止。

## Phase 7: Cross-cutting completion

dashboard、profile、notification center、Empty/error/loading、responsive、accessibility、performance、security hardening、backup/restore、observability、retention、incident runbook、UAT。

## Execution rules

- 一度に複数Phaseを飛び越えて実装しない。
- 前Phaseのmigration・認可・testを完了してから次へ進む。
- DB/API/Permission変更はDesign Freezeに従う。
- package追加は必要性、代替、license、security、bundle/運用影響を確認する。
- generated artifactとmigration履歴をsource controlする。
- testを後付けにしない。

## Final DoD

format、lint、typecheck、unit、component、integration、E2E、build、migration、RLS、RBAC matrix、AI evaluation、security、accessibility、backup restore、traceability、documentationがすべて成功・更新済み。
