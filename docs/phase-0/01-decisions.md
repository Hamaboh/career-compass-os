# Phase 0: 確定事項・暫定事項

## 1. ステータス定義

| 状態 | 意味 |
|---|---|
| `CONFIRMED` | 本再設計で確定。後工程はこの決定に従う |
| `PROVISIONAL` | 会社規定が未整備のため暫定採用。履歴と理由を保持する |
| `POC_REQUIRED` | 実装前PoCで確定する |
| `MANUAL_SETUP` | 設計外の管理画面・会社アカウント設定が必要 |
| `SUPERSEDED` | 旧仕様。履歴参照のみで実装禁止 |

## 2. プロダクト方針

| ID | 状態 | 決定 |
|---|---|---|
| P0-PROD-001 | CONFIRMED | 最上位価値は本人の幸福、ライフプラン、キャリアプラン、納得感である |
| P0-PROD-002 | CONFIRMED | freeksの制度は本人のキャリア実現に必要な場合のみ参照する |
| P0-PROD-003 | CONFIRMED | 本アプリは正式な人事評価・給与決定ツールではない |
| P0-PROD-004 | CONFIRMED | AIによる目標形成・SMART・1on1支援をMVP必須とする |
| P0-PROD-005 | CONFIRMED | メンバー本人はMVPではログインしない |
| P0-PROD-006 | CONFIRMED | 本人確認結果はULが記録し、本人確認前の目標は正式確定しない |

## 3. 利用者・権限

| ID | 状態 | 決定 |
|---|---|---|
| P0-AUTHZ-001 | CONFIRMED | 約7人のULと約5人の上位役職者、合計約12人をログイン利用者とする |
| P0-AUTHZ-002 | CONFIRMED | ULは自Unitのメンバー情報を閲覧・編集できる |
| P0-AUTHZ-003 | CONFIRMED | 上位役職者は全Unitを閲覧できるが、元データは原則編集しない |
| P0-AUTHZ-004 | CONFIRMED | 上位役職者はレビューコメント、差戻し、確認を行える |
| P0-AUTHZ-005 | CONFIRMED | 監査ログは各利用者のデータ権限範囲に限定する。システム管理者は全件閲覧できる |
| P0-AUTHZ-006 | CONFIRMED | 1on1記録は通常・機密・AI送信不可を区別する |
| P0-AUTHZ-007 | CONFIRMED | 上位役職者は通常記録を閲覧できる。機密記録は明示許可された利用者だけが閲覧できる |
| P0-AUTHZ-008 | CONFIRMED | Unit所属、兼務、休職、退職等のメンバー情報はULが手入力・確定する |

## 4. 認証

| ID | 状態 | 決定 |
|---|---|---|
| P0-AUTHN-001 | CONFIRMED | Google Workspaceを認証元とする |
| P0-AUTHN-002 | CONFIRMED | Cloudflare Accessの採用をPhase 3の基本案とする |
| P0-AUTHN-003 | CONFIRMED | IdP認証だけで認可を完了せず、アプリ側の登録状態・ロール・Unit scopeを検証する |
| P0-AUTHN-004 | SUPERSEDED | 旧MVPの招待、メールOTP、アプリパスワード、パスワードリセットは対象外 |

## 5. AI・プライバシー・費用

| ID | 状態 | 決定 |
|---|---|---|
| P0-AI-001 | CONFIRMED | 社内情報・個人識別情報を匿名化せず外部AIへ送信してはならない |
| P0-AI-002 | CONFIRMED | 匿名化済みの情報は承認済みAIへ送信できる |
| P0-AI-003 | CONFIRMED | ULはAI送信前に匿名化後の本文を毎回プレビュー・承認する |
| P0-AI-004 | CONFIRMED | 氏名、メール、社員ID、顧客名、案件名、会社固有語、人事評価用語を匿名化対象とする |
| P0-AI-005 | CONFIRMED | AI提案と本人発言、UL所見、確定データを分離する |
| P0-AI-006 | CONFIRMED | AIは夢、Why、目標、人事評価、昇格、給与、Course、組織判断を確定しない |
| P0-AI-007 | CONFIRMED | 低価格モデルを優先し、初期の月間AI費用上限を1,000円相当とする |
| P0-AI-008 | CONFIRMED | 上限到達時は新規AI処理を停止し、無断で課金上限を超えない |
| P0-AI-009 | POC_REQUIRED | 具体的なモデルは実装前PoCで品質、構造化出力、学習利用、保持条件、費用を比較して決定する |
| P0-AI-010 | CONFIRMED | 学習不使用条件を確認できないモデルは本番利用しない |

## 6. 制度・計算

| ID | 状態 | 決定 |
|---|---|---|
| P0-POLICY-001 | CONFIRMED | PDFは会社による社員個人の評価資料である |
| P0-POLICY-002 | CONFIRMED | Unit Leaders Missionは会社によるULのUnit・マネジメント評価資料である |
| P0-POLICY-003 | CONFIRMED | ULは個人評価とUL評価を独立して受ける |
| P0-POLICY-004 | CONFIRMED | 交通費提出期限は翌月2営業日目。土日祝日を休日とする |
| P0-POLICY-005 | CONFIRMED | レスポンススピードは業務連絡に24時間応答がないことを対象とする |
| P0-POLICY-006 | CONFIRMED | 評価期間は上期1月1日〜6月30日、下期7月1日〜12月31日とする |
| P0-POLICY-007 | CONFIRMED | 数値表示は小数第1位までとし、小数第2位以下を切り捨てる |
| P0-POLICY-008 | CONFIRMED | ManagementカテゴリーのKPIのみdraftとする |

## 7. 退職率・所属

| ID | 状態 | 決定 |
|---|---|---|
| P0-RET-001 | CONFIRMED | 別Unitへの異動は退職に数えない |
| P0-RET-002 | CONFIRMED | 会社を退職した時点の主所属Unitに退職者として数える |
| P0-RET-003 | CONFIRMED | Unit兼務者は主所属Unitだけに数える |
| P0-RET-004 | CONFIRMED | 休職者は期首・期末の平均メンバー数から除外する |
| P0-RET-005 | PROVISIONAL | 退職後に再入社しても過去の退職イベントは退職者として数える |
| P0-RET-006 | PROVISIONAL | Unit統合・分割時は評価期間期末の主所属Unitを所属対象とする |
| P0-RET-007 | CONFIRMED | 「8名以上のUnit」は平均メンバー数が8.0以上を意味する |
| P0-RET-008 | CONFIRMED | 平均メンバー数が0の場合、退職率は0%ではなく算出不能とする |

## 8. 共有・保持・運用

| ID | 状態 | 決定 |
|---|---|---|
| P0-OPS-001 | CONFIRMED | 本人向けHTMLには本人確認済みの目標、Why、行動、進捗、振り返り、制度接続等を含められる |
| P0-OPS-002 | CONFIRMED | 未承認AI推測、UL内部メモ、人事判断用メモ、監査ログを本人向けHTMLへ含めない |
| P0-OPS-003 | CONFIRMED | 共有URLの既定期限は7日、最大30日とし、手動失効できる |
| P0-OPS-004 | CONFIRMED | 在籍中の確定データは継続保存する |
| P0-OPS-005 | CONFIRMED | 退職・管理対象外から1年後に個人データを匿名化し、統計だけを残す |
| P0-OPS-006 | CONFIRMED | 監査ログを3年間保持する |
| P0-OPS-007 | CONFIRMED | 日次バックアップ、30日保持、RPO 24時間、RTO 1営業日を初期目標とする |
| P0-OPS-008 | CONFIRMED | 会社既存ドメインの本番・検証サブドメインを使用する |

## 9. 技術基準の現状

次はPhase 3で正式化する基本案であり、現時点のDesign Freezeではない。

- Next.js on Cloudflare Workers
- Cloudflare Access + Google Workspace
- Cloudflare D1
- Cloudflare R2
- Cloudflare AI Gateway
- Cloudflare Workers AIを初期候補とし、必要な処理だけ外部モデルを検討
- PostgreSQL、Redis、BullMQ、NestJS常駐API、VercelはMVP基本案から外す

## 10. 残作業

- 新Phase 1: プロダクト・業務・要件
- 新Phase 2: AI仕様
- 新Phase 3: 技術・データ・API・認証認可・セキュリティ
- 新Phase 4: UI/UX・テスト・開発計画
- Phase 5: 最終レビュー、トレーサビリティ、新Design Freeze
- 実装前AIモデルPoC
- Google Workspace、Cloudflare、利用者名簿、Unit・メンバー初期データの手動設定

