# Phase 4: テスト計画・E2Eシナリオ

## 1. Test pyramid

| Level | 対象 | 目的 |
|---|---|---|
| Static | TypeScript、lint、format、schema | 早期欠陥、型・規約 |
| Unit | domain policy、計算、state transition、redaction | 業務規則を高速検証 |
| Component | form、wizard、status、dialog、table | UI状態・a11y |
| Integration | D1 repository、R2、Access principal、API | transaction・認可・境界 |
| Contract | AI schema、Gmail adapter、Cloudflare binding | 外部I/Fの互換 |
| E2E | Browser→API→D1/R2→response | 実利用flow |
| Security | IDOR、CSRF、XSS、SQLi、JWT、share token | 攻撃境界 |
| Operational | migration、backup、restore、Cron、cost cap | 運用可能性 |

テストデータは合成情報のみ。本番Member・制度原文・AI Prompt本文をCI/previewへコピーしない。

## 2. Role・scope matrix

各private endpointと画面について最低限次を自動検証する。

| Actor | 自Unit通常 | 他Unit通常 | 自Unit機密 | 全Unit元編集 |
|---|---:|---:|---:|---:|
| UL | read/write | deny | owner/ACLのみ | deny |
| EXECUTIVE | read | read | ACLのみ | deny |
| SYSTEM_ADMIN | 運用上必要な範囲 | 運用上必要な範囲 | ACLのみ | 保守capability時のみ |
| 未登録Access user | deny | deny | deny | deny |

一覧、詳細、検索、export、audit、AI context、R2 downloadの全経路でnegative testを行う。UI button非表示だけをテスト完了としない。

## 3. Domain unit test

- 目標状態の正規遷移と不正遷移
- 本人確認recordなしの確定拒否
- AI提案から人間所有recordを別作成
- SMART例外の理由・再確認日
- 主所属・兼務・休職・退職・再入社
- 退職率、平均0、8.0境界、小数第2位以下切捨て
- 評価期間上期/下期境界
- 翌月第2営業日、土日、祝日、年跨ぎ
- 24時間ちょうど、その直前・直後
- share期限7日、最大30日、時刻境界、失効
- retention期限、AI提案保持の早い方
- 月額AI capの80%、100%、予約精算、月跨ぎ

祝日は内閣府等の承認済み一次データを年versionとしてfixture化し、source checksumを検証する。

## 4. AI・匿名化test

Phase 2 golden setを使用する。

- 氏名、メール、社員ID、顧客、案件、Unit、会社用語、制度用語を検出
- 組合せ再識別riskで送信停止
- `AI送信不可`を常に除外
- 機密は既定除外
- Unit越境dataが匿名化前のcontextへ入らない
- UL承認なしでは送信しない
- preview編集後は旧承認を失効
- AI応答のPII、禁止判断、unsupported factを拒否
- Prompt injectionに従わない
- schema不正を確定dataへ保存しない
- 予算100%で送信停止、高額modelへfallbackしない
- AI停止でもmanual flowが完了する

PoCの品質thresholdはPhase 2を維持する。

## 5. Security test

- forged、expired、wrong issuer/audience Access JWT
- app user suspended/revoked
- CSRF token欠落・不一致、wrong Origin
- IDを変更した他Unit access
- confidential record enumeration
- stored/reflected XSS payload
- SQL meta character・bound parameter
- raw share tokenのlog非出力
- expired/revoked/random share token
- share brute-force rate limit
- R2 object key direct access
- Secret/client bundle/build log scan
- error responseにstack/SQL/本文がない

## 6. Accessibility test

自動:

- axe等による主要画面のWCAG違反
- accessible name、label、landmark、heading
- color contrastのtoken検査
- HTML validation範囲

手動:

- keyboard-only全flow
- focus order、focus visible、modal復帰
- 200% zoom、reflow、狭いviewport
- screen readerでwizard、error、status、table、tabs、live region
- high contrast、reduced motion
- 本人向けHTMLの画面・印刷・download

自動検査合格だけでアクセシビリティ完了としない。

## 7. E2Eシナリオ

### E2E-01 認証・利用拒否

Google Workspace認証→Access JWT→登録ULは自Unit home表示。未登録userは内容を見ずaccess denied。

### E2E-02 Member登録・所属

ULが自UnitMemberを登録→主所属履歴→一覧表示。他Unitへの登録・閲覧はAPIで拒否。

### E2E-03 目標なしから探索

本人発言を記録→AI匿名化preview→UL承認→質問候補→将来像仮説→Why→目標草案→SMART→行動→本人確認snapshot。

### E2E-04 明確な目標shortcut

目標直接入力→自己分析全工程をskip→不足SMARTだけ質問→本人確認。制度linkなしで確定可能。

### E2E-05 本人修正・保留

snapshot確認→修正希望/保留→正式集計へ含めない→新版作成→再確認。

### E2E-06 AI停止

月額cap到達→AI prepare拒否→手動質問・SMART・1on1・共有を完了。

### E2E-07 1on1

差分集約→AI事前summary→質問選択→本人発言/UL所見/機密を記録→AI事後整理→人間確定→次回通知。

### E2E-08 機密

ULが機密・AI送信不可entry作成→AI contextから除外→ACLなしEXEC/API/audit linkで本文拒否。

### E2E-09 上位レビュー

EXECが全Unit通常情報→コメント→差戻し→UL対応→確認済み。元本文の直接編集不可。

### E2E-10 共有

確定情報だけでsnapshot→7日token→public閲覧/print/download→ULが本人確認記録→手動失効→再閲覧拒否。

### E2E-11 目標変更・競合

2 sessionが同じ目標編集→先行保存→後行409→差分表示→新版作成→本人再確認。

### E2E-12 制度版

ADMINが個人制度とUL Missionを別版登録→Management項目draft→目標へ任意link→新版でも過去link不変。

### E2E-13 退職率

兼務、休職、異動、退職、再入社を含む期間→rule通り計算→第1位表示、第2位切捨て→平均0は算出不能。

### E2E-14 Retention

1年経過candidate→preview→admin確認→個人data/R2匿名化→統計保持→監査metadata。

### E2E-15 Backup・restore

日次export→preview環境へrestore→schema、主要件数、R2参照、認可smoke→RTO記録。

## 8. Browser・viewport

現行の会社標準Chromeを主対象とし、最新安定Chrome/Edge、Safari相当で主要flowを確認する。desktop 1280px以上、tablet、mobile幅のreflowを検証する。具体versionは実装時のsupport policyへ固定する。

## 9. Test evidence

CI結果、E2E trace、screenshot、accessibility手動check、PoC評価、restore reportをrelease単位で参照できるようにする。失敗testをskipしてreleaseせず、例外は責任者、理由、期限、代替統制を記録する。
