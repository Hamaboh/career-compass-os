# Phase 4: MVP実装順序・Definition of Done

## 1. 実装方針

- vertical sliceで認証→認可→DB→API→UI→監査→testを一つずつ通す。
- 画面だけ、APIだけを大量に先行させない。
- 各sliceで他Unit拒否、機密拒否、error、auditを同時に作る。
- AIがなくても手動flowが成立してからAI補助を接続する。
- productionの個人情報を開発・PoCへ使用しない。
- Phase 5 Design Freezeと実装開始`READY`前にframework初期化を行わない。

## 2. 推奨実装順序

### Implementation 0: Repository foundation

- Next.js/TypeScript/OpenNext/pnpmのversion固定
- formatter、lint、typecheck、unit、build
- Cloudflare preview binding contract
- 環境・Secret schema
- CI、branch protection、secret scan
- error envelope、request ID、logging redaction

完了条件: 空のprotected appがpreviewで動き、production dataへ接続しない。

### Implementation 1: Authentication・RBAC

- Access JWT検証
- app user、role、Unit scope
- `/me`
- central authorization policy
- access denied
- Unit越境negative integration test
- role/scope変更監査

完了条件: UL/EXEC/ADMIN/未登録の許可・拒否matrixがAPIで通る。

### Implementation 2: Unit・Member

- Unit、Member、所属・状態履歴
- Member一覧・詳細・登録
- optimistic locking
- 休職・退職・兼務
- 最小監査

完了条件: UL自Unit編集、EXEC全Unitread、他Unit拒否。

### Implementation 3: 本人理解・将来像

- self analysis session/entry
- provenance、未回答、機密、AI送信不可
- future vision/value/career direction
- 手動質問flow

完了条件: 本人発言、UL所見、仮説、確認済みが混在しない。

### Implementation 4: 目標・Why・SMART・本人確認

- goal/version/state transition
- Why、SMART、例外
- action、progress、evidence、reflection
- wizardとshortcut
- confirmation record
- version diff

完了条件: 本人確認なしに確定不可、制度linkなしでも完了可能。

### Implementation 5: 1on1・通知

- 1on1前後、entry、機密ACL
- reminder rule、Cron、notification outbox
- Gmail adapterまたはdevelopment fake
- dashboard要対応

完了条件: AIなしで1on1準備→記録→次回行動→通知が完結。

### Implementation 6: AI safety pipeline

- scope済みcontext builder
- anonymization、leak detector
- prepare/preview/edit/approve/reject
- model policy、Prompt/schema version
- response validator
- suggestion decision
- budget reserve/ledger/cap
- Phase 2 PoC合格modelを接続

完了条件: UL未承認、PII、AI送信不可、cap到達、schema不正で外部送信・確定保存が起きない。

### Implementation 7: 共有HTML

- allowlist snapshot
- private R2
- share token hash、7〜30日、失効
- public CSP/no-store/noindex
- download/print
- confirmation record

完了条件: 未承認AI、内部メモ、他Memberがsnapshotへ入らず、失効が即時反映。

### Implementation 8: Executive review・制度・参考計算

- 全Unit overview
- review/comment/return/confirm
- policy document/version/item
- Management draft
- 退職率、営業日、24時間rule

完了条件: EXECが元データを編集できず、過去制度linkが新版で変わらない。

### Implementation 9: Admin・運用

- user/scope management
- AI settings/cost
- audit search
- retention candidate/execute
- backup/export/restore runbook
- observability、quota、incident switch

完了条件: RPO/RTO復旧演習、3年監査、1年後匿名化の安全な手順が実証される。

### Implementation 10: System acceptance・pilot

- 全E2E
- security test
- accessibility手動test
- performance/cost test
- synthetic data UAT
- 限定実data pilot
- runbook・training

完了条件: Design Freeze acceptanceを満たし、残課題と運用責任者が明確。

## 3. 各sliceの共通DoD

- 対応する要件IDと設計文書をPRへ記載。
- 正常・異常・境界・権限negative testがある。
- lint、typecheck、unit、integration、buildが成功。
- UIはloading、empty、error、success、409を持つ。
- keyboard操作、label、focus、contrastを確認。
- audit対象操作が本文なしで記録される。
- Secret・個人情報がcode、log、fixture、screenshotへない。
- migrationが空DBとupgradeで成功する。
- previewでOpenNext runtimeを検証する。
- documentationとrunbookを更新する。
- unrelated changeを含めない。

## 4. MVP全体DoD

### Product

- 約7 UL・約5上位役職者がGoogle Workspaceで利用可能。
- ULは自Unit、EXECは全Unitread/review、ADMINは運用管理。
- Member本人はaccountなしでHTML確認できる。
- 本人の幸福・ライフ・キャリアを会社制度より優先できる。
- 制度linkなしの目標を作れる。

### AI

- 質問、Why、SMART、1on1前後を支援。
- ULが匿名化後全文を毎回承認。
- AI提案・推測・人間確定を分離。
- 人事評価等をAIが確定しない。
- PoC threshold合格、学習不使用・保持条件確認。
- 1,000円cap、100%停止、manual fallback。

### Data・Security

- role/Unit/confidentialityをAPIで強制。
- share/private R2/Secret/JWT/CSRF/XSS/SQLi/IDOR統制。
- version、本人確認、制度版、監査を追跡。
- production dataをpreview/CIへ持ち込まない。

### Quality・Operations

- 主要E2E、security、WCAG 2.2 AA目標のmanual testに合格。
- 日次backup、30日保持、RPO24h、RTO1営業日を実証。
- Gmail通知、Cron、retention、AI停止runbookを確認。
- 月次cost見積りとalertを設定。
- 重大未解決riskがない。

## 5. Release判定

`READY`に必要:

1. Phase 5の全体reviewと新Design Freeze。
2. AI model PoC合格。
3. OpenNext version互換性確認。
4. Cloudflare planと30日backup方式の決定。
5. Google Workspace Access/Gmailの管理者設定方針。
6. security/privacy責任者、incident連絡先。
7. synthetic UATと限定pilotの承認。

いずれかが未完了なら実装開始またはproduction開始の該当gateを`NOT READY`とする。実装開始gateとproduction release gateは分離して判定する。

## 6. 将来拡張

- Member loginと本人セルフ入力
- Google Calendar、Slack等の連携
- 音声文字起こし
- Queues/Workflows
- 高度な統計
- Management制度正式化

将来候補をMVPのnavigation、DB、APIへ先回りして露出しない。
