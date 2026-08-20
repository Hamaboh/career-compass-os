# Phase 5: 実装引継ぎ仕様

## 1. 実装者が最初に行うこと

1. `AGENTS.md`とPhase 0〜5を正式読順で読む。
2. repository、branch、remote、履歴、tracked/untrackedを調査する。
3. application codeが未作成であることを確認する。
4. `53-design-freeze.md`と`52-readiness-gates-manual-setup.md`の現在gateを確認する。
5. Implementation 0だけを最初のPR scopeにする。
6. OpenNext互換versionを公式supportとpreview PoCで固定する。
7. 変更前に要件ID、decision、acceptance、非対象をPR planへ記載する。

## 2. 最初の実装scope

Implementation 0: Repository foundation。

- Next.js App Router、TypeScript、OpenNext、pnpm、Node LTSの最小構成。
- Cloudflare Workers preview用configuration。
- format、lint、typecheck、unit、build。
- environment schema、fake bindings、Secret境界。
- CI、secret scan、request ID、error envelope、log redaction。
- application feature、DB business table、AI、Member UIはまだ作らない。

OpenNext PoCの結果とversion ADRを同PRまたは直前の設計artifactへ含める。

## 3. 実装順序

`I0 foundation → I1 auth/RBAC → I2 Unit/Member → I3本人理解 → I4目標 → I5 1on1/通知 → I6 AI safety → I7共有 → I8 review/制度 → I9運用 → I10 acceptance/pilot`

順序変更は依存関係、risk、testへの影響を記録する。AI provider接続を手動flowより先に行わない。

## 4. PR単位の要求

各PRは次を含む。

- 対象Implementation slice。
- 対応FR/NFR/Decision ID。
- 変更前提と非対象。
- DB/API/UI/Auth/AI/Operationへの影響。
- migration/rollbackの有無。
- 正常、異常、境界、認可negative test。
- format/lint/typecheck/unit/integration/build結果。
- preview runtime確認。
- security/privacy/log/Secret確認。
- 残課題と次slice。

大きなsliceは動作するvertical sub-sliceへ分ける。UIだけ、APIだけを大量に先行させない。

## 5. Architecture guardrail

- UI/Server Action/Route Handlerは同じapplication serviceと認可policyを通す。
- RepositoryはPrincipal/scopeなしの業務queryを公開しない。
- SQLはprepared/bound、D1 transaction、optimistic locking。
- 外部副作用はoutbox/idempotency。
- R2はprivate、shareはWorker token検証。
- production/preview/local bindingとSecretを分離。
- 本番dataをfixture、screenshot、AI PoCへ使わない。
- 新dependencyは必要性、Workers互換、size、security、licenseをreview。

## 6. AI guardrail

POC-01合格前:

- fake provider、schema、redaction、preview、approval、budget ledgerだけ実装可。
- 実個人/社内dataを外部AIへ送らない。
- model名を推測で固定しない。

POC-01合格後:

- ADRのmodel/provider/保持条件だけを接続。
- scope→最小化→匿名化→UL preview→approval hashを迂回しない。
- responseをuntrustedとして検証。
- suggestionと人間確定recordを分離。
- 1,000円cap、高額fallback禁止、kill switch。

## 7. Security guardrail

- Access JWTのheaderだけを信用しない。
- app user、role、Unit、confidentiality、ACL、state、fieldをserver側で検証。
- 404でresource存在を秘匿する経路を設ける。
- GETでmutationしない。CSRF、Origin、Content-Typeを検証。
- Secret、token、Member本文、Prompt、SQL bind、stackをlog/errorへ出さない。
- Admin bypassは保守理由と監査を必須にする。

## 8. UX guardrail

- Member login画面を作らない。
- 会社制度を本人・将来像より上位に配置しない。
- AI提案と人間情報をbadge/sectionで区別。
- AI一括採用をprimaryにしない。
- URL閲覧を本人承認にしない。
- error/empty/loading/409/manual fallbackを各flowに持つ。
- WCAG 2.2 AA目標とkeyboard/manual test。

## 9. Stop conditions

次の場合、関連実装を止めて報告する。

- Design Freezeと要件が矛盾する。
- DB/API/Role/Unit/機密/AI境界の変更が必要。
- 本人中心原則と会社制度要件が衝突する。
- AI provider条件が学習不使用・保持要件を満たさない。
- Cloudflare Workersで選定dependency/runtimeが動かない。
- production data/Secretが安全に分離できない。
- migration/retention/restoreで不可逆data loss riskがある。

軽微な実装詳細は合理的に補完し、すべてを質問として返さない。

## 10. 実装完了報告

各slice終了時に以下を報告する。

- 変更file
- 対応要件・設計
- 実装内容
- DB/API/Auth/RBAC/AI/UI/Operation影響
- test結果
- security/privacy確認
- migration/rollback
- manual setup
- 未解決risk
- 次sliceの開始可否

Productionを完了と報告できるのは、`52-readiness-gates-manual-setup.md`の全checklistとI10 acceptanceが合格した場合だけ。
