# Career Compass OS

SES企業で分散常駐するメンバーについて、Unit Leaderが本人の幸福、ライフプラン、キャリアプランを起点に、納得感のある目標形成、行動、進捗、振り返り、1on1をAIで支援するアプリケーションです。

## 現在の状態

現在は**要件再定義後の再設計中（Phase 0〜2完了）**です。コード実装は開始していません。

旧Phase 1〜4、旧Design Freeze、旧補助仕様、旧ADRは履歴資料として残っていますが、現在の実装仕様ではありません。新Phase 1〜5と新Design Freezeが完成するまで実装は禁止です。

新しい設計基準は[`docs/phase-0/`](docs/phase-0/)から順に参照してください。

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

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 0 | 一次資料、決定事項、用語、制度ルール、旧仕様失効範囲 | 完了 |
| Phase 1 | プロダクト、業務、要件、MVP | 完了 |
| Phase 2 | AIロジック、匿名化、Prompt契約、評価・費用統制 | 完了 |
| Phase 3 | 技術、データ、API、認証認可、セキュリティ、運用 | 未着手 |
| Phase 4 | UI/UX、テスト、実装計画 | 未着手 |
| Phase 5 | 最終レビュー、トレーサビリティ、新Design Freeze | 未着手 |
| AI PoC | 低価格モデルの品質・安全性・費用比較 | 実装前に実施 |

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
