# Phase 5: 最終設計レビュー

## 1. 結論

新Phase 0〜4は、約7名のULと約5名の上位役職者が利用するLeader-only MVPとして整合している。本人中心、AIの補助境界、Google Workspace認証、Unit単位認可、機密、共有、保持、低コスト運用をDB/API/UI/testまで追跡でき、実装を止める重大な設計矛盾はない。

設計は`FROZEN`とする。Repository foundationからの実装開始は`READY`、AI provider接続とproduction releaseは個別gateが未完了のため`NOT READY`とする。

## 2. 目的・利用者・範囲

| 項目 | 最終仕様 |
|---|---|
| 最上位価値 | 本人の幸福、ライフプラン、キャリアプラン、納得感 |
| ログイン利用者 | 約7 UL、約5 EXECUTIVE/SYSTEM_ADMIN |
| Member | MVPでは非ログイン。ULとの対話と本人向けHTMLで確認 |
| UL | 自UnitのMember、目標、1on1、AI、共有を管理 |
| EXECUTIVE | 全Unitの通常情報をread/review。元データ非編集 |
| SYSTEM_ADMIN | 利用者、scope、制度、AI設定、監査、保持、運用 |
| 非目的 | 正式人事評価、給与、昇格、配属、診断、離職予測 |

## 3. 要件漏れレビュー

| 領域 | 結果 | 主な正式文書 |
|---|---|---|
| 認証・認可 | Google Workspace + Access + app RBAC/Unit/ACL | `34`, `35`, `40`, `45` |
| Unit・Member | 手入力、主所属、兼務、休職、退職、履歴 | `31`, `32`, `33`, `41` |
| 本人理解 | 経験、感情、価値観、未回答、仮説 | `21`, `31`, `41` |
| 目標 | 階層、Why、SMART、行動、成果、進捗、版 | `21`, `31`, `41` |
| AI | 質問、Why、SMART、1on1、匿名化、費用 | `20`〜`25`, `42` |
| 1on1 | 前・中・後、通常・機密・AI不可 | `24`, `31`, `42` |
| 本人確認・共有 | snapshot、HTML、URL、失効、証跡 | `31`, `33`, `42` |
| 制度 | 個人/UL分離、版、draft、任意link | `03`, `31`, `43` |
| レビュー | コメント、差戻し、確認、元編集なし | `33`, `34`, `43` |
| 監査・保持 | event、scope、3年、1年後匿名化 | `31`, `35`, `36`, `43` |
| 復旧 | 日次、30日、RPO24h、RTO1営業日 | `36`, `45`, `46` |
| UX・品質 | error、empty、a11y、security、E2E、DoD | `44`〜`46` |

MUST要件の未設計項目はない。

## 4. 矛盾レビュー

### 4.1 解消済み

- 旧Member login/招待/OTP/passwordはLeader-only MVPと矛盾するため失効。
- 旧Next.js + NestJS + PostgreSQL + Redis + BullMQは小規模低コスト要件と矛盾するためWorkers + D1へ置換。
- Executive全Unitreadと機密保護は通常情報read + record ACLで両立。
- AI必須と毎回人間承認は、業務内の明示AI操作 + manual fallbackで両立。
- R2 presigned URLの期限と最大30日共有はWorker検証tokenで解消。
- Google Workspace既存SMTP希望とWorkers port 25制約はGmail API基本、465/587 SMTP PoC待ちへ分離。

### 4.2 矛盾ではない未確定

- AI model/providerはPoCで確定する。
- Cloudflare Free/Paid planはquota、30日backup、WAF等の費用比較で確定する。
- SMTP adapterはGmail APIの代替が必要な場合だけPoCする。
- 再入社の退職計上、Unit統合・分割の期末所属は会社規定ができるまで暫定。

これらはstatusとgateが明示されており、確定仕様へ紛れ込んでいない。

## 5. 過剰設計レビュー

MVPから次を除外した。

- Member account、電子署名、自由登録
- microservice、NestJS、Redis、BullMQ、常駐server
- 初期必須のQueues/Workflows
- 音声録音、文字起こし、real-time AI
- multi-agent、large RAG、vector DB
- Slack/メール内容監視、Calendar自動連携
- 人事評価・給与・Course・配属の決定
- 離職予測、心理診断、人物ranking
- Management draft KPIの正式利用

DBはMVP要件を満たす範囲に限定し、将来候補のためだけのtable/API/UIを作らない。

## 6. Security・Privacyレビュー

### 成立している統制

- Access JWTの署名、issuer、audience、期限検証。
- app user status、capability、Unit scope、confidentiality、record ACL。
- resource取得時のscope queryとnegative test。
- CSRF、XSS、SQL injection、IDOR、share token対策。
- Private R2、hash化share token、期限・失効。
- AI contextはscope→最小化→匿名化→UL全文preview→承認。
- AI responseをuntrusted dataとしてschema・PII・禁止判断検査。
- Secret、本文、Prompt、tokenを一般log/auditへ複製しない。
- production dataをpreview/CI/PoCへコピーしない。

### 残余risk

| Risk | 制御・受入 |
|---|---|
| D1にRLSがない | Principal必須repository、scope query、全endpoint negative matrix |
| 匿名化後の再識別 | 最小context、UL preview、意味保持不能時は送信禁止 |
| ULがAI案を押し付ける | 本人の言葉を別保存、pilot training、本人修正率測定 |
| Member非ログインで更新が遅い | 1on1統合、通知、共有HTML、次回確認日 |
| System Adminの強権限 | admin bypass限定、理由、監査、二者確認 |
| Backup/restore未実証 | production gateで復旧演習を必須化 |

重大riskは設計上無統制のまま残っていない。

## 7. AI責任境界レビュー

AIが許可されるのは質問候補、整理、比較、矛盾候補、Why仮説、SMART監査、行動候補、1on1前後の補助である。AIは夢、Why、目標、評価、給与、昇降格、Course、配属、組織判断、診断、離職を確定しない。

AI proposalは本人発言・UL所見・確定dataと別保存し、人間が採用した内容から別の人間所有recordを作る。AI停止、cap到達、provider障害でも手動flowは継続する。

## 8. UXレビュー

- 質問は1回1〜3問。
- 目標作成は探索、曖昧、明確、今は作らないの4入口。
- `分からない/答えたくない/保留`を正常状態とする。
- 会社制度はwizard後半のoptional step。
- SMARTは軸別理由で、合計点による自動確定なし。
- URL閲覧を本人承認とみなさない。
- statusは色だけで表さず、人物評価表現を避ける。
- WCAG 2.2 AAを目標に自動・手動検査。

## 9. 運用・コストレビュー

- Workers single full-stack、D1、Private R2、Cron + D1 job/outboxを基本とする。
- Queuesは必要性が確認された場合のみ。
- AIは月額1,000円相当、80%警告、100%停止、高価格自動fallbackなし。
- 日次backup、30日保持、RPO24h、RTO1営業日。
- Gmail APIを基本送信adapterとし、メール本文へ機密を含めない。
- 無料運用を保証せず、plan・AI・domain・Workspace費用を月次追跡する。

## 10. 最終判定

| Gate | 判定 | 理由 |
|---|---|---|
| Design completeness | `READY` | 要件・決定・DB・API・UI・test・運用が整合 |
| Design Freeze | `FROZEN` | 本書群を正式実装仕様にする |
| Implementation 0開始 | `READY` | repository foundationは未確定外部接続なしで開始可能 |
| Implementation 1〜5 | `READY_WITH_ENV_GATES` | Access/preview fake・bindingを段階設定し実装可能 |
| AI provider接続 | `NOT_READY` | AI model PoCと契約確認が未完了 |
| Production release | `NOT_READY` | Access/Gmail/plan/backup/incident/pilot未完了 |

`NOT_READY`は設計不足ではなく、外部設定・PoC・運用実証が未完了であることを意味する。
