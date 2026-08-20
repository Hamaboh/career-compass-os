# Phase 4: 最終UXレビュー・トレーサビリティ・完了判定

## 1. Phase 1〜4横断レビュー

### 要件漏れ

| 確認項目 | 結果 |
|---|---|
| Member非ログイン | 独自Member画面を作らず、UL共同操作・共有HTMLへ統一 |
| 目標なし/曖昧/明確/保留 | 4入口とshortcutを定義 |
| 本人確認 | snapshot、方法、日時、回答、本人の言葉を定義 |
| AI送信承認 | prepare→preview→edit→approveを画面化 |
| AI/manual fallback | 全flowに手動経路 |
| EXEC review | 全Unitread、コメント・差戻し・確認、元編集なし |
| 機密 | record区分、ACL、AI除外、UI非露出 |
| 制度 | 個人/UL分離、任意link、draft、版固定 |
| 共有 | HTML、download、print、7〜30日、失効 |
| 監査・保持・復旧 | 管理画面、test、runbook、DoDへ反映 |

漏れなし。メール通知はPhase 1で自動連携対象外だったが、Phase 3でアプリ自身の通知配信手段としてGmail API adapterを設計した。外部メール内容監視は引き続き対象外。

### 矛盾

- 旧必須画面の招待、OTP、パスワードは新Leader-only/Access設計と矛盾するため作らない。
- 旧Member dashboardは作らず、本人共有HTMLへ置換した。
- Executive全Unit閲覧と機密保護は、通常情報read + 機密ACLで両立させた。
- AI必須とAI送信毎回承認は、AIをoptional actionとして業務中に明示起動することで両立した。
- 共有最大30日とR2 presigned URL制約はWorker検証tokenで解消済み。

### 過剰設計

- Member account、独自auth画面、microservice、real-time AI、録音、自由なdashboard builderを除外。
- UIで全ER tableを直接管理させず、業務task単位へ集約。
- queue、advanced RAG、多Agentを初期実装順へ含めない。

## 2. AIが勝手に判断するrisk

| Risk | UX統制 |
|---|---|
| AI質問をそのまま本人へ提示 | ULが採用・編集してから使用 |
| AI Whyを本人事実化 | 別card、未確認badge、本人の言葉欄へ自動copyしない |
| SMART合計点で確定 | 軸別理由・質問、人間例外、本人確認 |
| AIが目標変更 | 差分候補のみ、新版と本人再確認 |
| AIが人事評価 | 禁止、制度参考表示、rankingなし |
| AIが匿名化漏れ | UL全文preview、再検査、risk時送信停止 |

残余riskはULがAI表現を本人へ押し付ける運用。pilot trainingで「AI案は質問素材」「本人の言葉へ戻す」を必須にする。

## 3. UL負荷

削減する部分:

- 前回差分、未完了、期限の自動集約
- 質問候補、SMART不足、1on1前後の整理
- 共有HTMLの再利用
- 通知・レビューの受信箱

残る人間業務:

- 本人との対話
- 匿名化送信preview
- AI提案の採否
- 本人確認記録
- 機密判断
- 目標・支援の最終判断

これらは負担削減より安全性・本人納得を優先して残す。匿名化previewの時間が過大になるriskは、置換候補と差分表示、操作目的ごとの最小contextで軽減し、pilotで所要時間を測る。

## 4. 継続利用risk

- Memberがログインしないため本人の即時更新性は低い。
- ULの入力が滞ると情報が古くなる。
- 質問が多いと1on1が尋問化する。
- 目標が評価管理に見えると本人納得を失う。

対策:

- 1on1の流れに記録を統合し、別作業を減らす。
- 1回1〜3問、skip/保留、目標なしを許容。
- 本人向けHTMLで本人の言葉と確認状態を見える化。
- dashboardは制度KPIでなく本人・次行動を優先。
- pilotで準備時間、質問採用率、本人修正率、更新周期を測る。

## 5. 会社KPIと本人Whyの分離risk

制度linkはwizard後半のoptional stepとし、本人の将来像・Whyを先に確定する。制度候補には本人への価値、版、draft、`関連付けない`を表示する。制度linkがない目標を異常・不足として扱わない。

## 6. Requirement traceability

| 要件群 | UX・test文書 |
|---|---|
| FR-AUTH | `40` access denied、`43` user管理、`45` E2E-01 |
| FR-MEM | `40/41` Member画面、`45` E2E-02 |
| FR-SELF | `41` 自己理解・4入口、`45` E2E-03/04 |
| FR-GOAL | `41` wizard/SMART/確認、`45` E2E-03〜05/11 |
| FR-AI | `42` preview/提案、`45` AI test/E2E-06 |
| FR-1ON1 | `42` 前・中・後、`45` E2E-07/08 |
| FR-SHARE | `42` HTML/token、`45` E2E-10 |
| FR-POLICY | `43` version/draft、`45` E2E-12/13 |
| FR-REV | `43` review inbox、`45` E2E-09 |
| FR-AUDIT/OPS | `43` admin、`45` E2E-14/15 |
| Accessibility | `44` WCAG、`45` automated + manual |
| Implementation | `46` vertical slices、DoD、release gate |

## 7. Phase 4で新たに確定した事項

| ID | 状態 | 決定 |
|---|---|---|
| P4-UX-001 | CONFIRMED | Member本人向けaccount画面を作らず、UL共同操作と共有HTMLにする |
| P4-UX-002 | CONFIRMED | 目標作成は4入口のwizard + shortcut |
| P4-UX-003 | CONFIRMED | AIは全操作でpreview承認を通す |
| P4-UX-004 | CONFIRMED | AI提案の一括採用をprimaryにしない |
| P4-UX-005 | CONFIRMED | WCAG 2.2 AAを目標に自動・手動testを行う |
| P4-UX-006 | CONFIRMED | 共有URL閲覧を本人承認とみなさない |
| P4-UX-007 | CONFIRMED | UI statusは色だけに依存せず、人物評価表現を避ける |
| P4-TEST-001 | CONFIRMED | role/Unit/confidentiality negative matrixを全経路で検証 |
| P4-DEV-001 | CONFIRMED | 手動flow成立後にAI safety pipelineを接続 |
| P4-DEV-002 | CONFIRMED | vertical slice順序と共通DoDを実装基準にする |

## 8. Phase 4完了条件

- 必須画面、route、遷移、role別操作が定義されている。
- 目標、SMART、AI、1on1、共有、review、adminの状態別UXが定義されている。
- loading、empty、error、競合、失敗時manual fallbackがある。
- WCAG 2.2 AA目標と手動accessibility検証が定義されている。
- unit/integration/E2E/security/operational testが受入条件へ対応している。
- 実装順序、各slice DoD、MVP DoD、release gateが定義されている。
- Phase 0〜3のDB/API/権限/AI境界を変更していない。
- code、component、package、migration、cloud resourceを作成していない。

次のPhase 5で、全要件ID、設計決定、画面、API、table、test、運用の最終traceability、未確定事項、AI PoC、手動setupをレビューし、新Design Freezeと`READY/NOT READY`を確定する。
