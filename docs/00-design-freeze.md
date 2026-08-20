# Design Freeze

## 1. 状態

- 仕様状態: FROZEN FOR IMPLEMENTATION
- 実装準備判定: READY（`15-implementation-readiness.md`参照）
- 対象: Phase 1〜4および本インデックスから参照される実装補助仕様
- リポジトリ状態: 実装開始前
- 正式仕様言語: 日本語

## 2. 最上位原則

1. 本人の納得感を最優先する。
2. AIは夢、Why、目標、人事評価、組織判断を確定しない。
3. AIの推測と人間が明示・確認した情報を分離する。
4. Memberの自己分析、夢、Why等は機微情報として最小権限で扱う。
5. 会社KPIとUnit Leaders Missionは本人のキャリアへの接続を探索するが、接続を強制しない。
6. 夢や目標がない状態、探索中、保留、修正、中断を正当な状態として扱う。
7. 分散常駐を標準状態とし、日常観察を前提にしない。
8. 認可はFrontendだけに依存せず、APIとDBで強制する。

## 3. 実装ルール

- 実装上必要な軽微な変更は許可する。
- 軽微な変更でも、理由と影響をcommitまたはADRに記録する。
- DB、API、Permission、Unit scope、visibility、AI責任境界の変更は軽微とみなさない。
- 要件と実装が矛盾する場合は、実装前に報告して判断を得る。
- 新しいlibraryやpatternを導入する前に、既存仕様とstackで要件を満たせないか確認する。
- AI生成結果を人間の確定操作なしに正式業務データへ昇格させない。
- 過去の削除済み実装や旧設計を仕様根拠として再利用しない。
- 実装者が自ら確認できる事項をユーザーへ質問せず、repositoryの正式文書を確認する。

## 4. 変更区分

### 4.1 軽微な変更

- file・moduleの配置
- 内部class・function名
- UIの微細なspacingや文言調整
- index追加等、外部契約を変えない性能改善
- test helper、fixture、development tool

軽微な変更は要件、データ意味、外部API、権限、security境界を変えてはなりません。

### 4.2 設計変更

以下は事前承認とADRが必要です。

- table、主要column、relation、状態遷移の追加・削除・意味変更
- API endpoint、request/response、error、idempotencyの外部契約変更
- Role、Permission、Unit scope、ownership、visibilityの変更
- 認証、招待、OTP、password、session方式の変更
- AIが参照するデータ、実行可能な操作、人間承認の変更
- 制度versionと過去目標の関係変更
- 個人情報・機微情報の共有・保持方針変更
- MVP scopeの変更

## 5. AIと人間の境界

AIが自動実行できるのは、原則として下書き・候補生成・検出・構造化・計算です。以下は人間の確定が必要です。

- 自己理解候補の採用
- 夢・将来像
- Why
- キャリア方向
- 目標
- SMART例外
- 目標変更・中断・撤回
- 1on1正式記録
- KPI・Missionの正式解釈
- 人事評価
- 組織上の判断
- 外部への送信・共有

## 6. 既定の解釈

- Memberは原則1つの主Unitへ所属する。将来の兼務に備えてmembership履歴を持つ。
- ULは有効なassignmentを持つUnitだけを支援する。
- ADMINは組織管理可能だが、機微な本人情報の無条件閲覧権限を意味しない。
- ULの「アプリ編集」はUnit向け支援コンテンツ編集であり、社員マスタ・全社制度・AI provider設定ではない。
- 自己分析、夢、Whyの既定visibilityは本人のみ。
- 目標、進捗、本人が共有した1on1準備情報は対象ULと共有できる。
- UL私的メモはMVPで原則実装しない。必要になった場合は別ADRと保持方針を必須とする。
- 通知はMVPでin-appを必須、emailは認証と重要通知に限定して導入する。
- LLMへ客先機密、credential、source code、健康情報、ハラスメント本文、他Member情報を自動送信しない。
- 技術baselineと外部依存の既定はADR-0006、ADR-0007に従う。
- 法務、契約、社内連絡先、production credentialは本番移行条件であり、adapterと安全なfallbackを使う実装開始を妨げない。

## 7. 完了条件

各実装Phaseは、対応要件、API、DB、UI、unit/integration/E2E/security testがtraceability matrixで接続され、lint、typecheck、test、build、migration、認可testに成功した場合のみ完了です。
