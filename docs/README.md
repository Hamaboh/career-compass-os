# 設計文書インデックス

## 正式仕様の読順

1. [`00-design-freeze.md`](00-design-freeze.md)
2. [`01-product-definition.md`](01-product-definition.md)
3. [`02-ai-career-support-logic.md`](02-ai-career-support-logic.md)
4. [`03-technical-architecture.md`](03-technical-architecture.md)
5. [`04-ui-ux-delivery-plan.md`](04-ui-ux-delivery-plan.md)
6. 実装対象に対応する補助仕様
7. [`13-traceability-matrix.md`](13-traceability-matrix.md)
8. [`14-implementation-roadmap.md`](14-implementation-roadmap.md)

## 文書一覧

| 文書 | 目的 |
|---|---|
| [`00-design-freeze.md`](00-design-freeze.md) | 仕様の優先順位、変更管理、禁止事項 |
| [`01-product-definition.md`](01-product-definition.md) | 課題、利用者、体験、MVP境界 |
| [`02-ai-career-support-logic.md`](02-ai-career-support-logic.md) | AI責任、自己分析、夢、Why、SMART、継続支援 |
| [`03-technical-architecture.md`](03-technical-architecture.md) | システム、認証、認可、DB、AI、運用 |
| [`04-ui-ux-delivery-plan.md`](04-ui-ux-delivery-plan.md) | 情報設計、画面、UX、開発順序 |
| [`05-data-model.md`](05-data-model.md) | 論理データモデル、制約、状態 |
| [`06-api-contract.md`](06-api-contract.md) | API資源、操作、共通契約 |
| [`07-rbac-access-control.md`](07-rbac-access-control.md) | Permission、Unit、ownership、visibility |
| [`08-authentication-security.md`](08-authentication-security.md) | 招待、OTP、password、session、安全対策 |
| [`09-ai-contracts.md`](09-ai-contracts.md) | AI入出力、provenance、人間承認、禁止事項 |
| [`10-ui-screen-specification.md`](10-ui-screen-specification.md) | 画面ごとの目的、component、状態、権限 |
| [`11-test-plan.md`](11-test-plan.md) | testレイヤー、E2E、security、AI評価 |
| [`12-operations-and-retention.md`](12-operations-and-retention.md) | 環境、監視、backup、保持、incident |
| [`13-traceability-matrix.md`](13-traceability-matrix.md) | 要件から実装・testへの追跡 |
| [`14-implementation-roadmap.md`](14-implementation-roadmap.md) | 実装Phase、依存、DoD |
| [`decisions/`](decisions/) | Architecture Decision Records |

## 仕様の強さ

優先順位は以下です。

1. `00-design-freeze.md`
2. Phase 1〜4
3. 補助仕様
4. ADR
5. 実装詳細

下位文書が上位文書に矛盾する場合は、上位文書を優先し、実装を止めて矛盾を報告します。
