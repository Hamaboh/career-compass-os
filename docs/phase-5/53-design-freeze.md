# Career Compass OS — Design Freeze

## 1. Status

| 項目 | 状態 |
|---|---|
| Design version | `DF-2026-08-21-01` |
| Design status | `FROZEN` |
| Design completeness | `READY` |
| Repository implementation start | `READY` |
| Live AI provider connection | `NOT READY: POC-01 required` |
| Production release | `NOT READY: external/operational gates required` |

本書を新しい正式Design Freezeとする。旧`docs/00-design-freeze.md`、旧Phase 1〜4、旧補助仕様、旧ADRは履歴資料であり、実装根拠ではない。

## 2. 正式仕様の優先順位

1. 利用者が今後明示的に承認したchange decision。
2. 本Design Freeze。
3. 新Phase 0のsource baseline、decision、policy、supersession。
4. 新Phase 1〜4の正式文書。
5. Phase 5のreview、traceability、readiness、handoff。
6. 会社制度原本。ただしPhase 0で明示補正された内容を優先。
7. 一般的な技術best practice。

旧設計はこの順位に含めない。

## 3. Product Freeze

- 最上位価値は本人の幸福、ライフプラン、キャリアプラン、納得感。
- 会社制度は必要な場合だけ参照し、目標接続を強制しない。
- 本アプリは正式な人事評価・給与決定ツールではない。
- AIはMVP必須だが、人間の意思決定を代替しない。
- ログイン利用者は約7 UL + 約5 EXECUTIVE/SYSTEM_ADMIN。
- Member本人はMVPではログインしない。
- 本人の確認はULが方法、日時、回答、本人の言葉として記録する。

## 4. Authorization Freeze

- `SYSTEM_ADMIN`、`EXECUTIVE`、`UL`をroleとする。
- ULは自Unitの通常業務dataをread/write。
- EXECUTIVEは全Unitの通常情報をread/reviewし、元データ非編集。
- SYSTEM_ADMINは運用権限であり、機密本文の当然の閲覧権ではない。
- 機密記録は明示ACL。
- `AI_SEND_PROHIBITED`はAI Contextへ入れない。
- Frontend表示を認可とせず、API/application/repositoryで強制。
- D1にRLSがないため、Principal必須、scope付きquery、negative matrixを必須とする。

## 5. AI Freeze

- AIは質問、Why仮説、SMART監査、行動候補、1on1前後の整理を補助。
- AIは夢、Why、目標、人事評価、給与、昇降格、Course、配属、組織判断、診断、離職を確定しない。
- 情報出所を本人発言、本人確認済み、UL所見、system fact、policy、AI推測、AI提案、不明に分離。
- scope→最小化→匿名化→UL全文preview→承認→送信→応答検査→人間採否の順序を固定。
- AI提案を直接確定dataへ昇格させず、採用内容から人間所有recordを作成。
- 氏名、メール、社員ID、顧客、案件、会社固有語、人事評価用語を外部送信しない。
- 再識別riskが残る場合は送信しない。
- 月額1,000円相当、80%警告、100%停止、高価格model自動fallbackなし。
- model/providerはPOC-01で確定。合格前はfake providerのみ。

## 6. Goal・1on1 Freeze

- 目標階層は幸福/生活→将来像→Why→方向→通過点→任意制度→行動→証拠→振り返り。
- 目標入口は探索、曖昧、明確、今は作らないの4つ。
- SMARTは軸別`OK/要改善/不足`、合理的例外と再確認日。
- 本人確認前の目標を正式集計しない。
- 確定後変更は上書きせず新版、差分、理由、本人再確認。
- 1on1は事前、実施、事後を分け、原メモ、AI整理案、人間確定を分離。
- 録音、文字起こし、real-time AI評価はMVP対象外。

## 7. Sharing Freeze

- 本人確認済みallowlistから不変HTML snapshotを生成。
- Private R2へ保存し、Workerがhash化token、期限、失効を検証。
- 既定7日、最大30日、手動即時失効。
- HTML view、download、browser print。
- 未承認AI、UL内部/人事判断memo、非共有機密、audit、他Memberを含めない。
- URL閲覧を本人承認とみなさない。
- public responseはno-store、noindex、strict CSP、外部resourceなし。

## 8. Policy Freeze

- 個人評価資料とUnit Leaders Missionを独立管理。
- ULは個人評価とUL評価を独立して受ける。
- Management categoryだけdraftで通常利用から除外。
- 交通費期限は翌月第2営業日、土日祝日除外。
- response ruleは業務連絡に24時間応答がないこと。
- 上期1/1〜6/30、下期7/1〜12/31。
- 表示は小数第1位、第2位以下切捨て。
- 退職率は主所属、休職除外、Unit異動非計上、平均0は算出不能。
- 再入社計上とUnit統合/分割の期末所属は`PROVISIONAL`。

## 9. Technical Freeze

- Next.js App Router + TypeScriptをOpenNextでCloudflare Workersへ単一deploy。
- D1 + Drizzle + SQL migration。
- Private R2。
- Cloudflare Access + Google Workspace + app RBAC。
- REST `/api/v1`、Zod、cursor、optimistic locking、idempotency。
- Cron + D1 job/outboxを初期background処理。
- Queuesは必要性が確認された場合だけ。
- Gmail APIを初期mail adapter。SMTPは必要時に465/587 PoC。
- D1 Time Travel + 必要時日次R2 export。
- production/preview/localを分離し、本番dataを非本番へコピーしない。
- NestJS、PostgreSQL、Redis、BullMQ、Vercel、app password、OTPをMVPで採用しない。

## 10. Quality Freeze

- WCAG 2.2 AA目標。keyboard、screen reader、zoom、printを手動検査。
- role/Unit/confidentiality negative matrixを全API/画面/export/audit/AI/R2で検証。
- security testはJWT、CSRF、XSS、SQLi、IDOR、share、Secret、log leakageを含む。
- AIはPhase 2 golden set。
- 日次backup、30日保持、RPO24h、RTO1営業日を復旧演習で実証。
- 実装はI0〜I10のvertical slice、各slice共通DoD。
- 手動flow成立後にAI safety pipelineを接続。

## 11. Change Control

### 無断変更禁止

次は事前にdecision recordと影響reviewが必要。

- Product目的、Member login有無、Role、Unit scope、機密
- AI送信・匿名化・人間承認・費用cap
- Goal/本人確認状態、制度計算、保持期間
- DB/API/Auth/Share/Backup architecture
- MVP範囲、禁止判断、正式評価との境界

### 軽微変更

文言、layout、非破壊的index、内部関数分割等、要件・data・API・権限・securityへ影響しない変更は実装PRに理由を記載して可能。

### 変更手順

1. 問題と根拠を記録。
2. 影響する要件ID、decision、table、API、screen、test、operationを列挙。
3. Security、privacy、cost、migration、本人中心原則をreview。
4. Product owner承認。
5. Design Freeze versionとtraceabilityを更新。
6. 実装・回帰test。

## 12. Implementation Authority

実装者は`AGENTS.md`の読順に従い、本Design Freezeを最終authorityとして使用する。設計にない技術的細部は最小変更で補完できるが、上記無断変更禁止領域を推測で変更してはならない。

Repository foundationは開始してよい。実AI provider接続はPOC-01合格後、本番releaseは`52-readiness-gates-manual-setup.md`のchecklist完了後に限る。
