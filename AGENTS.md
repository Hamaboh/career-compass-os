# Repository Instructions

## Mandatory first step

実装・修正・package追加・migration作成の前に、以下を順番に読むこと。

1. `docs/00-design-freeze.md`
2. `docs/01-product-definition.md`
3. `docs/02-ai-career-support-logic.md`
4. `docs/03-technical-architecture.md`
5. `docs/04-ui-ux-delivery-plan.md`
6. 変更対象に対応する`docs/05`〜`docs/14`
7. `docs/decisions/`

## Design authority

- Phase 1〜4とDesign Freezeを正式仕様とする。
- DB、API、Permission、Unit scope、visibility、認証、AI責任境界を無断変更しない。
- 矛盾を発見した場合は実装前に報告する。
- 軽微な実装判断は理由を記録する。
- 重要変更にはADRと関連文書・traceability・test更新が必要。
- 削除済みの過去実装を復元・流用しない。

## AI boundary

- AI提案と本人・UL・ADMINが確定したdataを分離する。
- AIは夢、Why、目標、人事評価、制度解釈、組織判断を確定しない。
- AI Contextへ他Member、非共有情報、客先機密、credentialを含めない。
- AIが利用不能でも主要flowを手動完遂可能にする。

## Authorization

- Frontend表示だけを認可としない。
- API Guard/PolicyとPostgreSQL RLSを実装・testする。
- ADMIN、対象Unit UL、別Unit UL、本人、他Member、EXCLUDED、未認証をnegative testする。
- ULのUnit content編集と社員情報管理を混同しない。

## Verification

変更に応じてformat、lint、typecheck、unit、component、integration、E2E、build、migration、RLS、security、accessibilityを実行する。失敗を残したまま完了としない。

## Git hygiene

- 関係ないfileを変更しない。
- applied migrationを書き換えない。
- secret、`.env`、password、OTP、token、session ID、AI keyをcommit・log出力しない。
- generated artifactとmigration履歴の扱いは正式なproject設定に従う。
