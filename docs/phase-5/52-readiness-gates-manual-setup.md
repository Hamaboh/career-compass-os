# Phase 5: Readiness Gate・PoC・手動セットアップ

## 1. Gateを分離する理由

設計完成、repository実装開始、AI provider接続、本番運用は異なる条件を持つ。外部設定が未完了であることを理由にcode設計を止めず、未検証providerを見切り接続しないため、次の4 gateへ分離する。

## 2. Gate判定

| Gate | 現在 | 許可されること | 禁止されること |
|---|---|---|---|
| G0 Design Freeze | `READY/FROZEN` | Phase 0〜5を実装根拠にする | 無断要件変更 |
| G1 Repository implementation | `READY` | Implementation 0、fake adapter、合成test | 本番data/Secret、production deploy |
| G2 External integration | `PARTIAL` | preview Cloudflare/Access等を個別条件後接続 | 未PoC AI、本番共有 |
| G3 Production release | `NOT READY` | なし | 実Member運用開始 |

## 3. Implementation slice別gate

| Slice | 判定 | 前提 |
|---|---|---|
| I0 Repository foundation | READY | Design Freezeのみ |
| I1 Authentication/RBAC | READY_WITH_FAKE | JWT validatorとfake principalで開始。実AccessはMANUAL-01後 |
| I2 Unit/Member | READY | 合成data、D1 local/preview |
| I3 本人理解 | READY | 合成data、AIなし |
| I4 目標/Why/SMART/確認 | READY | AIなしで成立 |
| I5 1on1/通知 | READY_WITH_FAKE | fake mailで開始。GmailはMANUAL-02後 |
| I6 AI safety pipeline | READY_FOR_INTERNAL_LOGIC | redaction/schema/budgetをfake providerで実装。実AI送信はPOC-01合格後 |
| I7 共有HTML | READY_FOR_PREVIEW | 合成snapshot。Production public shareはsecurity gate後 |
| I8 Review/制度/計算 | READY | 合成制度。正式資料取込は初期data review後 |
| I9 Admin/運用 | READY_FOR_PREVIEW | production restore/retentionはG3前に実証 |
| I10 Acceptance/Pilot | NOT READY | 全slice、external settings、PoCが必要 |

## 4. PoC一覧

### POC-01 AI model/provider — 必須

入力: Phase 2合成golden set。

比較:

- 低価格候補2〜3model
- 日本語質問、Why、SMART、1on1前後
- structured output
- PII・社内語・禁止判断
- Prompt injection
- token/費用
- 学習利用、保持、削除、subprocessor

合格:

- PII/社内情報の重大漏えい0
- 禁止判断0
- 入力にない重大事実0
- schema適合95%以上、保存経路100% validation
- 根拠精度95%以上
- 質問/1on1有用性4/5以上
- SMART一致90%以上
- 月額1,000円見込み内
- 学習不使用と許容可能な保持条件を確認

成果: model/provider/prompt/schemaのADR。合格前はfake providerのみ。

### POC-02 OpenNext互換 — I0内で必須

- Next.js安定版、OpenNext adapter、Node.js LTS、Wranglerを固定。
- App Router、Route Handler、Server ActionをWorkers previewでsmoke。
- D1/R2 Binding、security header、build、rollbackを確認。

成果: version ADRとlockfile。I0の一部として自動実行可能。

### POC-03 既存SMTP — 条件付き

Gmail APIを基本とするため必須ではない。会社が既存SMTPを要求した場合だけport 465/587、TLS、auth、送信元、rate、Workers互換を合成宛先で確認する。port 25は使用しない。

### POC-04 Cost/plan — G3前に必須

- Workers、D1、R2、Access/Zero Trust、AI Gateway/AI、Gmail、domainの月額。
- D1 Time Travel 30日または日次R2 export。
- WAF/rate limitの必要機能。
- 12人通常利用とbackup storage。

成果: free/paid選択、月額上限、80% alert、責任者。

## 5. 手動セットアップ

| ID | 作業 | 必要権限 | Gate |
|---|---|---|---|
| MANUAL-01 | Zero Trust、Google Workspace IdP、preview/prod Access app/AUD/policy | Workspace/Cloudflare admin | 実Access/G3 |
| MANUAL-02 | Gmail API project、専用送信account/alias、OAuth/service account、SPF/DKIM/DMARC | Workspace/Google Cloud admin | 実mail/G3 |
| MANUAL-03 | Cloudflare account、domain、DNS、preview/prod subdomain | Domain/Cloudflare admin | preview/G3 |
| MANUAL-04 | Workers、D1、R2、AI Gateway、Secret、Build integration | Cloudflare/GitHub admin | preview/G3 |
| MANUAL-05 | 初期SYSTEM_ADMIN、EXEC/UL、Unit scope | App admin、二者確認 | pilot |
| MANUAL-06 | Unit/Member初期data、制度版、祝日calendar | UL/Admin | pilot |
| MANUAL-07 | backup/alert/incident連絡先、security/privacy責任者 | 会社責任者 | G3 |
| MANUAL-08 | 限定pilot対象、Member説明、UL training | Product owner/UL | I10 |

Secretや個人dataをchat、issue、PR、repositoryへ貼らない。設定値はCloudflare/Google/GitHubのsecret storeへ投入する。

## 6. Production gate checklist

- [ ] Phase 0〜5 Design Freezeがmainにある。
- [ ] I0〜I9の共通DoDと全E2Eが合格。
- [ ] POC-01 AI、POC-02 OpenNext、POC-04 planが合格。
- [ ] Access JWTとapp RBAC/Unit/ACLのnegative test合格。
- [ ] Gmailまたは承認済みmail adapterの送信・retry・redaction合格。
- [ ] AI学習不使用・保持条件が記録されている。
- [ ] AI capとkill switchを実証。
- [ ] Private R2、share token、期限・失効・no-storeを実証。
- [ ] 日次backup、30日保持、RPO24h、RTO1営業日の復旧演習合格。
- [ ] production/preview分離、Secret scan、log redaction合格。
- [ ] security/privacy/incident責任者と連絡先がある。
- [ ] 合成UATと限定pilotが承認済み。
- [ ] 利用者説明に「正式人事評価ツールではない」と明記。

未完了が1つでもあればproductionは`NOT READY`。

## 7. 現在の残作業

設計作業は完了。実装前後の残作業は以下だけである。

1. Implementation 0内のOpenNext互換PoC。
2. AI provider接続前のAI model PoC。
3. Cloudflare/Google Workspaceの手動設定。
4. Plan/backup方式の費用判断。
5. 実装I0〜I10と各DoD。
6. 合成UAT、限定pilot、production gate。

設計を追加し続ける必要はない。新事実・要件変更が発生した場合だけchange controlを用いる。
