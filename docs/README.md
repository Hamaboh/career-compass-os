# 設計文書インデックス

## 現在の設計状態

要件変更により、既存のPhase 1〜4、Design Freeze、補助仕様、ADRは履歴資料になりました。現時点では実装根拠として使用できません。

新しい設計はPhase 0から再構築し、Phase 3まで完了しています。新Phase 1〜5と新Design Freezeが完成するまでコード実装は禁止です。

## 現在の正式な読順

1. [`phase-0/00-source-baseline.md`](phase-0/00-source-baseline.md)
2. [`phase-0/01-decisions.md`](phase-0/01-decisions.md)
3. [`phase-0/02-glossary.md`](phase-0/02-glossary.md)
4. [`phase-0/03-policy-rules.md`](phase-0/03-policy-rules.md)
5. [`phase-0/04-supersession.md`](phase-0/04-supersession.md)
6. [`phase-1/10-product-definition.md`](phase-1/10-product-definition.md)
7. [`phase-1/11-personas-journeys.md`](phase-1/11-personas-journeys.md)
8. [`phase-1/12-use-cases-workflows.md`](phase-1/12-use-cases-workflows.md)
9. [`phase-1/13-requirements.md`](phase-1/13-requirements.md)
10. [`phase-1/14-mvp-acceptance.md`](phase-1/14-mvp-acceptance.md)
11. [`phase-2/20-ai-principles-modules.md`](phase-2/20-ai-principles-modules.md)
12. [`phase-2/21-self-life-career-goal-logic.md`](phase-2/21-self-life-career-goal-logic.md)
13. [`phase-2/22-anonymization-context-boundary.md`](phase-2/22-anonymization-context-boundary.md)
14. [`phase-2/23-ai-contracts-state-transitions.md`](phase-2/23-ai-contracts-state-transitions.md)
15. [`phase-2/24-one-on-one-continuous-support.md`](phase-2/24-one-on-one-continuous-support.md)
16. [`phase-2/25-poc-evaluation-cost.md`](phase-2/25-poc-evaluation-cost.md)
17. [`phase-3/30-architecture-stack.md`](phase-3/30-architecture-stack.md)
18. [`phase-3/31-data-model-er.md`](phase-3/31-data-model-er.md)
19. [`phase-3/32-data-rules-migrations.md`](phase-3/32-data-rules-migrations.md)
20. [`phase-3/33-api-contracts.md`](phase-3/33-api-contracts.md)
21. [`phase-3/34-auth-rbac-access-control.md`](phase-3/34-auth-rbac-access-control.md)
22. [`phase-3/35-security-privacy-threat-model.md`](phase-3/35-security-privacy-threat-model.md)
23. [`phase-3/36-operations-deployment-recovery.md`](phase-3/36-operations-deployment-recovery.md)
24. [`phase-3/37-decisions-traceability.md`](phase-3/37-decisions-traceability.md)
25. 今後作成する新Phase 4〜5
26. 今後作成する新Design Freeze

## Phase 0文書

| 文書 | 目的 |
|---|---|
| [`phase-0/00-source-baseline.md`](phase-0/00-source-baseline.md) | Google Drive一次資料、資料責任境界、原本補正、優先順位 |
| [`phase-0/01-decisions.md`](phase-0/01-decisions.md) | 確定・暫定・PoC待ちの決定台帳 |
| [`phase-0/02-glossary.md`](phase-0/02-glossary.md) | 本人中心、制度、AI、権限、保持の用語定義 |
| [`phase-0/03-policy-rules.md`](phase-0/03-policy-rules.md) | 評価分離、交通費、レスポンス、退職率、共有、保持 |
| [`phase-0/04-supersession.md`](phase-0/04-supersession.md) | 旧仕様の失効範囲、実装禁止、再設計ゲート |

## Phase 1文書

| 文書 | 目的 |
|---|---|
| [`phase-1/10-product-definition.md`](phase-1/10-product-definition.md) | コンセプト、ビジョン、課題、利用者、価値、成功状態、非目的 |
| [`phase-1/11-personas-journeys.md`](phase-1/11-personas-journeys.md) | ペルソナ、As-Is/To-Be、各利用者のジャーニー |
| [`phase-1/12-use-cases-workflows.md`](phase-1/12-use-cases-workflows.md) | 主要ユースケースと業務フロー |
| [`phase-1/13-requirements.md`](phase-1/13-requirements.md) | ID付き機能・非機能・禁止要件 |
| [`phase-1/14-mvp-acceptance.md`](phase-1/14-mvp-acceptance.md) | MVP範囲と受入条件 |

## Phase 2文書

| 文書 | 目的 |
|---|---|
| [`phase-2/20-ai-principles-modules.md`](phase-2/20-ai-principles-modules.md) | AI原則、情報出所、論理モジュール、人間の判断境界 |
| [`phase-2/21-self-life-career-goal-logic.md`](phase-2/21-self-life-career-goal-logic.md) | 自己理解、将来像、Why、目標階層、SMART、本人確認 |
| [`phase-2/22-anonymization-context-boundary.md`](phase-2/22-anonymization-context-boundary.md) | 外部送信分類、匿名化、最小コンテキスト、漏えい対策 |
| [`phase-2/23-ai-contracts-state-transitions.md`](phase-2/23-ai-contracts-state-transitions.md) | AI入出力契約、状態遷移、提案採否、監査証跡 |
| [`phase-2/24-one-on-one-continuous-support.md`](phase-2/24-one-on-one-continuous-support.md) | 1on1、進捗、通知、目標変更、例外処理 |
| [`phase-2/25-poc-evaluation-cost.md`](phase-2/25-poc-evaluation-cost.md) | PoC、品質基準、モデル選定、月額1,000円上限 |

## Phase 3文書

| 文書 | 目的 |
|---|---|
| [`phase-3/30-architecture-stack.md`](phase-3/30-architecture-stack.md) | Workers上のNext.js単一構成、D1/R2/AI/Gmail、環境境界 |
| [`phase-3/31-data-model-er.md`](phase-3/31-data-model-er.md) | Identity、Member、目標、1on1、AI、共有、監査のERとtable |
| [`phase-3/32-data-rules-migrations.md`](phase-3/32-data-rules-migrations.md) | transaction、整合性、計算、競合、migration |
| [`phase-3/33-api-contracts.md`](phase-3/33-api-contracts.md) | REST API、error、AI preview/approve、share endpoint |
| [`phase-3/34-auth-rbac-access-control.md`](phase-3/34-auth-rbac-access-control.md) | Access JWT、RBAC、Unit scope、機密ACL、CSRF |
| [`phase-3/35-security-privacy-threat-model.md`](phase-3/35-security-privacy-threat-model.md) | 脅威、XSS/SQLi/IDOR、Secret、AI・監査・incident |
| [`phase-3/36-operations-deployment-recovery.md`](phase-3/36-operations-deployment-recovery.md) | CI/CD、通知、backup、復旧、監視、費用guardrail |
| [`phase-3/37-decisions-traceability.md`](phase-3/37-decisions-traceability.md) | 技術決定、要件対応、残余risk、Phase 3完了判定 |

## 旧文書

`00-design-freeze.md`、`01-product-definition.md`〜`15-implementation-readiness.md`、`decisions/`は旧設計の履歴資料です。削除せず、新設計の根拠として引用せず、新Design Freeze完成後にアーカイブ表示を再検討します。

## 重要な変更点

- Member本人ログインからLeader-only MVPへ変更。
- Google Workspace + Cloudflare Accessを認証基本案とする。
- PostgreSQL、Redis、BullMQ、NestJS前提を失効。
- Cloudflare Workers、D1、R2、AI Gateway、Workers AIを基本案として再評価。
- 本人の幸福・ライフ・キャリアを会社制度より上位に置く。
- AIは必須だが、匿名化、UL送信前確認、人間による確定を必須とする。
- 本アプリは正式な人事評価・給与決定ツールにしない。
