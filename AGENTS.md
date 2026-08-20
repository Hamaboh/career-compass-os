# Repository Instructions

## Current state

本リポジトリは再設計中であり、実装開始前である。旧Phase 1〜4、旧Design Freeze、旧補助仕様、旧ADRは履歴資料であり、現時点の実装根拠ではない。

新Phase 1〜5および新Design Freezeが完成し、実装開始判定が`READY`になるまで、アプリケーションコード、framework初期化、package、schema、migration、deploymentを作成してはならない。

## Mandatory reading order

設計作業の前に、以下を順番に読むこと。

1. `docs/phase-0/00-source-baseline.md`
2. `docs/phase-0/01-decisions.md`
3. `docs/phase-0/02-glossary.md`
4. `docs/phase-0/03-policy-rules.md`
5. `docs/phase-0/04-supersession.md`
6. `docs/phase-1/10-product-definition.md`
7. `docs/phase-1/11-personas-journeys.md`
8. `docs/phase-1/12-use-cases-workflows.md`
9. `docs/phase-1/13-requirements.md`
10. `docs/phase-1/14-mvp-acceptance.md`
11. `docs/phase-2/20-ai-principles-modules.md`
12. `docs/phase-2/21-self-life-career-goal-logic.md`
13. `docs/phase-2/22-anonymization-context-boundary.md`
14. `docs/phase-2/23-ai-contracts-state-transitions.md`
15. `docs/phase-2/24-one-on-one-continuous-support.md`
16. `docs/phase-2/25-poc-evaluation-cost.md`
17. 作業対象の後続Phase文書

旧`docs/00-design-freeze.md`および旧`docs/01`〜`docs/15`は、変更経緯確認以外には使用しない。

## Product authority

- 最上位価値は本人の幸福、ライフプラン、キャリアプラン、納得感である。
- freeksの人事制度は本人のキャリア実現に必要な場合だけ参照し、目標への接続を強制しない。
- 本アプリは会社の正式な人事評価・給与決定ツールではない。
- ログイン利用者はMVPで約7人のULと約5人の上位役職者を想定する。Member本人はログインしない。
- ULは自Unit、上位役職者は全Unitを読み取る。上位役職者は元データを原則編集しない。

## AI boundary

- AIはMVP必須だが、提案・質問・整理・SMART監査・1on1支援に限定する。
- AIは夢、Why、目標、人事評価、昇格、給与、Course、組織判断を確定しない。
- AI提案、AI推測、本人発言、UL所見、本人確認済み情報、確定データを分離する。
- 匿名化されていない社内情報・個人識別情報を外部AIへ送信しない。
- 氏名、メール、社員ID、顧客名、案件名、会社固有語、人事評価用語を匿名化対象とする。
- Unit scope認可、最小化、匿名化の順に処理し、再識別リスクが残る場合は送信しない。
- ULが匿名化後の送信内容を毎回プレビューし、承認してからAIへ送信する。
- AI応答を検証し、人間が採用した内容から別の確定レコードを作る。AI提案を直接昇格させない。
- 学習不使用条件を確認できないAIモデルを本番利用しない。
- 具体的なAIモデルは実装前PoCで確定する。
- AI費用は初期月額1,000円を上限とし、到達時は新規AI呼出しだけを停止する。

## Authorization

- Frontend表示だけを認可としない。
- APIで利用者状態、ロール、Unit scope、記録の機密区分を検証する。
- 監査ログ経由で権限外情報を漏えいさせない。
- D1を前提とする永続層の認可強制方法は新Phase 3で確定する。旧PostgreSQL RLS仕様を流用しない。

## Source documents

正式な会社制度インプットは次である。

- Google Drive `人事評価&給与制度説明資料_260401.pdf`（社員個人評価）
- Google Drive `Unit Leaders Mission`（ULのUnit・マネジメント評価）

資料とPhase 0決定が矛盾する場合は、利用者が明示したPhase 0決定を優先する。

## Change management

- 重要変更は決定理由、影響範囲、状態（確定・暫定・PoC待ち）を記録する。
- 制度、AI、認証、認可、Unit scope、保持期間に影響する変更は関連文書とトレーサビリティを更新する。
- 暫定ルールを事実上の正式ルールとして無言で固定しない。
- Secret、credential、token、個人情報、AI keyをcommit・ログ出力しない。

## Verification

Phase 0〜5の設計変更では、少なくとも以下を確認する。

- 文書リンク、用語整合性、決定IDの重複
- 確定・暫定・PoC待ちの区別
- 旧仕様を正式仕様として参照していないこと
- 本人中心原則と会社制度参照の境界
- AIと人間の責任境界、AI提案と確定データの分離
- Unit越境、機密情報、匿名化、再識別の境界
- AI障害・予算停止時の手動継続
