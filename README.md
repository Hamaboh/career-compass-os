# Career Compass OS

SES企業で分散常駐するメンバーについて、Unit Leaderが本人の幸福、ライフプラン、キャリアプランを起点に、納得感のある目標形成、行動、進捗、振り返り、1on1をAIで支援するアプリケーションです。

## 現在の状態

現在は**要件再定義後の設計完了（Phase 0〜5完了・Design Freeze済み）**で、Implementation 0〜5を実装済みです。継続支援は進捗・振り返り・参考指標・1on1・可変周期リマインダー・D1 outbox・development fake通知まで利用できます。実AI、Gmail、production接続は未実装です。

## 開発・検証

Node.js `22.22.0`とpnpm `10.28.1`を使用します。`corepack enable`後、`pnpm install --frozen-lockfile`で導入し、`pnpm dev`で起動します。`.env.example`は非Secretの説明だけを持ち、実値はCloudflare/GitHubのSecret storeで管理します。本番dataをlocal/CI/previewへコピーしてはいけません。

`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm build:cloudflare`、`pnpm audit --audit-level=high`が標準検証です。`pnpm preview:smoke`はlocal Workersでhealth、request ID、security headerを検証します。local D1/R2 stateとbuild/cacheはGit管理しません。

PRではclean install、上記検証、secret scanを必須とします。previewはpreview専用bindingだけを使います。Production resource作成・deploymentはI0対象外です。rollbackはbindingを確認して直前のreview済みWorkers versionへ`wrangler rollback`するか、直前のreview済みcommitを再deployします。I0にmigrationはありません。詳細は[ADR-0008](docs/decisions/0008-implementation-0-runtime-versions.md)を参照してください。

local/previewの通知は外部サービスへ送らず、`/api/v1/reminder-jobs/run`がログイン利用者自身の期限到来ruleをD1 outboxへ冪等に集約し、`DELIVERED_FAKE`へ遷移させます。Gmail/Cronのproduction設定は後続の運用ゲートで行います。

旧Phase 1〜4、旧Design Freeze、旧補助仕様、旧ADRは履歴資料として残っていますが、現在の実装仕様ではありません。新Phase 0〜5と新Design Freezeを正式仕様とします。

実装時は[`docs/phase-0/`](docs/phase-0/)から[`docs/phase-5/`](docs/phase-5/)まで順に参照してください。Repository foundationは開始可能です。実AI接続はAI PoC合格後、本番運用は本番ゲート合格後に限ります。

## 現在の中核方針

- 最上位価値は本人の幸福、ライフプラン、キャリアプラン、納得感。
- freeksの人事制度は、本人のキャリア実現に必要な場合だけ参照する。
- 本アプリは会社の正式な人事評価・給与決定ツールではない。
- MVPのログイン利用者は約7人のULと約5人の上位役職者。
- Member本人はMVPではログインせず、1on1と本人向けHTMLで内容を確認する。
- ULは自Unitを管理し、上位役職者は全Unitを読み取り・レビューする。
- AIによる目標形成、Why探索、SMART監査、1on1支援をMVP必須とする。
- AIは夢、Why、目標、人事評価、昇格、給与、組織判断を確定しない。
- AI送信前に会社・個人・顧客・案件・人事制度固有情報を匿名化し、ULが毎回プレビューする。
- AI費用は初期月額1,000円を上限とし、到達時はAIだけを停止して手動機能を継続する。
- 約12人規模で、Cloudflare中心の最小コスト構成を再設計する。

## 新設計の進行

| Phase   | 内容                                                 | 状態             |
| ------- | ---------------------------------------------------- | ---------------- |
| Phase 0 | 一次資料、決定事項、用語、制度ルール、旧仕様失効範囲 | 完了             |
| Phase 1 | プロダクト、業務、要件、MVP                          | 完了             |
| Phase 2 | AIロジック、匿名化、Prompt契約、評価・費用統制       | 完了             |
| Phase 3 | 技術、データ、API、認証認可、セキュリティ、運用      | 完了             |
| Phase 4 | UI/UX、テスト、実装計画                              | 完了             |
| Phase 5 | 最終レビュー、トレーサビリティ、新Design Freeze      | 完了             |
| AI PoC  | 低価格モデルの品質・安全性・費用比較                 | 実AI接続前に実施 |

## Phase 0の読順

1. [`00-source-baseline.md`](docs/phase-0/00-source-baseline.md)
2. [`01-decisions.md`](docs/phase-0/01-decisions.md)
3. [`02-glossary.md`](docs/phase-0/02-glossary.md)
4. [`03-policy-rules.md`](docs/phase-0/03-policy-rules.md)
5. [`04-supersession.md`](docs/phase-0/04-supersession.md)

## Phase 1の読順

1. [`10-product-definition.md`](docs/phase-1/10-product-definition.md)
2. [`11-personas-journeys.md`](docs/phase-1/11-personas-journeys.md)
3. [`12-use-cases-workflows.md`](docs/phase-1/12-use-cases-workflows.md)
4. [`13-requirements.md`](docs/phase-1/13-requirements.md)
5. [`14-mvp-acceptance.md`](docs/phase-1/14-mvp-acceptance.md)

## Phase 2の読順

1. [`20-ai-principles-modules.md`](docs/phase-2/20-ai-principles-modules.md)
2. [`21-self-life-career-goal-logic.md`](docs/phase-2/21-self-life-career-goal-logic.md)
3. [`22-anonymization-context-boundary.md`](docs/phase-2/22-anonymization-context-boundary.md)
4. [`23-ai-contracts-state-transitions.md`](docs/phase-2/23-ai-contracts-state-transitions.md)
5. [`24-one-on-one-continuous-support.md`](docs/phase-2/24-one-on-one-continuous-support.md)
6. [`25-poc-evaluation-cost.md`](docs/phase-2/25-poc-evaluation-cost.md)

## Phase 3の読順

1. [`30-architecture-stack.md`](docs/phase-3/30-architecture-stack.md)
2. [`31-data-model-er.md`](docs/phase-3/31-data-model-er.md)
3. [`32-data-rules-migrations.md`](docs/phase-3/32-data-rules-migrations.md)
4. [`33-api-contracts.md`](docs/phase-3/33-api-contracts.md)
5. [`34-auth-rbac-access-control.md`](docs/phase-3/34-auth-rbac-access-control.md)
6. [`35-security-privacy-threat-model.md`](docs/phase-3/35-security-privacy-threat-model.md)
7. [`36-operations-deployment-recovery.md`](docs/phase-3/36-operations-deployment-recovery.md)
8. [`37-decisions-traceability.md`](docs/phase-3/37-decisions-traceability.md)

## Phase 4の読順

1. [`40-information-architecture-screens.md`](docs/phase-4/40-information-architecture-screens.md)
2. [`41-ul-member-goal-ux.md`](docs/phase-4/41-ul-member-goal-ux.md)
3. [`42-ai-one-on-one-share-ux.md`](docs/phase-4/42-ai-one-on-one-share-ux.md)
4. [`43-executive-admin-ux.md`](docs/phase-4/43-executive-admin-ux.md)
5. [`44-error-empty-accessibility.md`](docs/phase-4/44-error-empty-accessibility.md)
6. [`45-test-plan-e2e.md`](docs/phase-4/45-test-plan-e2e.md)
7. [`46-implementation-roadmap-dod.md`](docs/phase-4/46-implementation-roadmap-dod.md)
8. [`47-phase4-review-traceability.md`](docs/phase-4/47-phase4-review-traceability.md)

## Phase 5の読順

1. [`50-final-design-review.md`](docs/phase-5/50-final-design-review.md)
2. [`51-master-requirements-traceability.md`](docs/phase-5/51-master-requirements-traceability.md)
3. [`52-readiness-gates-manual-setup.md`](docs/phase-5/52-readiness-gates-manual-setup.md)
4. [`53-design-freeze.md`](docs/phase-5/53-design-freeze.md)
5. [`54-implementation-handoff.md`](docs/phase-5/54-implementation-handoff.md)
