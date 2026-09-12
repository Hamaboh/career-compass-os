# Implementation 10: Local/CI synthetic acceptance preparation evidence

## 判定

| 項目 | 判定 |
|---|---|
| 基準 | `495a1e3c066daf2b7b0bf8cf5531c10afa8ab97d`（Implementation 9 merge） |
| I10 local/CI synthetic acceptance preparation | `COMPLETE` |
| Implementation 10 entry gate | `NOT READY` |
| Implementation 10 overall | `NOT STARTED / NOT READY` |
| Limited real-data pilot | `NOT RUN / production-only` |
| Production release | `NOT READY` |

本書はDesign Freezeを変更せず、Implementation 10のentry gateが開いた後に行うsystem acceptanceへ向けた準備証跡である。local/CI commandの成功をImplementation 10本体の完了・合格とは扱わない。正式authorityは
`phase-5/53-design-freeze.md`であり、旧`00-design-freeze.md`は履歴資料である。
依頼にあった`docs/DESIGN_FREEZE.md`は基準commitに存在しないため、正式文書を直接確認した。

## 変更前gapと解消

| I10準備項目 | 変更前gap | 証跡/対応 | local/CI結果 |
|---|---|---|---|
| 全role/actor UAT | slice別testはあったが、12 login userと非login actorをまとめたfixtureがない | `test-system-acceptance.py`（7 UL、3 EXECUTIVE、2 SYSTEM_ADMIN、MEMBER、EXCLUDED） | PASS |
| 認証・legacy auth | Access JWT testはあるがI10で対象外経路を明示していない | auth suite + invite/OTP/password/Member login route不在test | PASS/N/A |
| RBAC/Unit/IDOR/機密/audit | slice別negative testのみ | system acceptance role matrixと既存全integration suite | PASS |
| share/AI/継続支援/admin | slice別testのみ | I3〜I9 migration/application suitesを単一acceptance commandへ集約 | PASS |
| security negative | CSRF、XSS/SQLi相当、JWT、rate、Secret、AI停止等が分散 | acceptance command、audit、gitleaks、dependency audit | PASS |
| accessibility/responsive | focus styleはあったがskip link、semantic nav、mobile/print/reduced-motionが不足 | layout/CSS safeguard + automated source contract | PASS (manual production confirmation remains) |
| performance/capacity/cost | 12人規模の再現可能なthreshold/measurementがない | 12 login users、120 Members、200 list queries、25 ms/query、10 MiB local DB threshold | PASS |
| backup/restore | I9 exerciseはあるがI10入口に未集約 | recoverable V2 artifact、fresh DB restore、FK/count/checksum、failure/idempotency tests | PASS |
| evidence/pilot separation | I10証跡がない | 本書とrunbook checklist | PASS |

招待、OTP、アプリパスワード、password reset、Member accountは
`P0-AUTHN-004`およびMVP対象外により「実装してE2E」ではなく「経路が存在しないこと」を受入とする。
実在Memberを使う限定pilotはsynthetic-only制約とproduction gateのため未実施である。正式readiness gateが
`NOT READY`である間は、local/CI preparationが成功してもImplementation 10本体を開始・完了・合格扱いにしない。

## 自動準備検査matrix

- **SYSTEM_ADMIN**: 運用capability、理由必須maintenance bypass、二者retention、backup/restoreを確認。
- **EXECUTIVE**: 全Unit通常read/reviewを許可し、Member元data editとACLなし機密readを拒否。
- **UL**: 自Unit read/writeを許可し、別Unit ID差替えを404でconceal。
- **MEMBER**: login role/accountを作らず、token検証済みのimmutable share HTMLだけを表示/DL/print。
- **EXCLUDED**: app user/Principalを作らず、認証後もapplication dataへ到達不能。
- **AI**: fake providerだけを使用。scope→最小化→匿名化→preview→承認hash→response validation→人間採否を検査し、提案から確定recordへの直接昇格を拒否。
- **攻撃境界**: forged/expired/wrong issuer/audience JWT、suspended/revoked/unregistered user、CSRF/origin/content type、IDOR/ACL、XSS/SQL metacharacter、random/expired/revoked share、rate limit、error/log redaction、quota/kill switch/maintenanceを検査。

全fixtureのdomainとdisplay nameは合成値であり、外部AI、mail、Cloudflare production resourceへ送信しない。

## 性能・容量・cost

再現可能なlocal thresholdは、120 Members（想定login利用者1人あたり10人）、Unit一覧25件を
200回取得した平均`< 25 ms`、合成DB `< 10 MiB`、foreign key error `0`とした。2026-09-11の実測は
平均`0.050 ms`、`1,064,960 bytes`、foreign key error `0`。これはSQLite上の回帰閾値であり、
Cloudflare network latencyやproduction D1性能の代替ではない。

費用判定は有料契約や変動するplan価格を仮定せず、12 login user/120 Member fixture、operation別AI ledger、
月額1,000円相当cap、80% warning、100% kill switch、backup bytesを測定単位とする。実AI費用はfake providerのため
`0円`。Workers/D1/R2/Access/Gmail/domainの最新free/paid選択と月額見積りは`POC-04`で管理者が確認する。

## 復旧演習

合成dataだけで全migrationをfresh/upgrade適用し、recoverable backup artifactを新規SQLiteへrestoreした。
artifact checksum、schema version、全table row count、foreign keyを検査し、既存出力先の上書きを拒否する。
失敗backupは同じidempotency keyで安全に再試行し、不完全artifactを`READY`にしない。local exerciseは
RPO 24時間/RTO 1営業日を満たすが、production D1 Time Travel/R2/binding切替演習はproduction-onlyである。

## Accessibility・responsive

自動検査は日本語lang、main/heading、form label、table caption、live status、44 px target、白と暗色の二重focus境界、
skip link、semantic navigation、40 rem reflow、reduced motion、printを対象とした。keyboard-only、focus順、
200% zoom、screen reader、high contrast、Chrome/Edge/Safari相当、本人向けHTMLの実機print/DLは、
preview URLで次のmanual checklistを実施して署名するまでproduction完了にしない。

## Production-only残作業

1. `POC-01`: provider/model、学習不使用、保持、品質、実費を承認し、それまではfake providerを維持。
2. `POC-04`: 現行Cloudflare/Gmail/domain plan、30日backup方式、80% alertと責任者を承認。
3. MANUAL-01〜08: Access/Workspace、Gmail、domain、D1/R2/Secret、初期user/Unit、incident連絡先、training。
4. preview上でJWT、private R2、rate/WAF、Cron、Gmail fake/approved adapter、backup失敗通知を確認。
5. accessibility手動検査とproduction相当performance/load smokeを記録。
6. 合成UATをProduct ownerが承認後、同意を得た限定pilotを本番管理手順下で実施。
7. 異なる2名のSYSTEM_ADMINとincident責任者がproduction restore/binding切替を演習。

以上が完了して正式entry gateが開くまでImplementation 10は`NOT READY`であり、production releaseも`NOT READY`である。外部AI、本番data、Production Secretを投入しない。

## P0/P1/P2 self-review

- **P0**: E2E-01〜15、MVP DoD、production gateを再照合。legacy authを誤実装せず、entry gate未達とpilot未実施を明示し、I10完了表現を除去した。
- **P1**: role/Unit/ACL/IDOR、AI人間境界、Secret/PII、share、retention、restoreを照合。重大未解決事項なし。
- **P2**: focus contrastと全fallbackのskip targetを修正し、全TypeScript/integration境界を含む重複のないacceptance commandへ更新した。実機a11y、production latency、外部設定は上記gateへ残し、合格と誤記していない。

PR #32のreview指摘に対する未解決事項は0件。production-only残作業は不具合ではなく、正式gateを開くための未充足prerequisiteとして上記一覧で追跡する。
