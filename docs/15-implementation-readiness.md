# 実装準備完了判定

## 1. 判定

- 判定日: 2026-08-20
- 判定: **READY**
- 対象: Phase 0（Repository foundation）からの実装開始
- application code、framework初期化、dependency追加、migration生成: 本判定作業では未実施

Phase 1〜4、Design Freeze、補助仕様、ADRを突合した結果、実装開始を妨げる要件・DB・API・RBAC・認証・AI責任境界の未決定はない。

## 2. 自動確定した実装baseline

| 項目 | 決定 | 固定方法 |
|---|---|---|
| repository | npm workspacesによるmonorepo | root manifestとlockfile |
| runtime | Node.js 24 LTS | runtime file、CI、container |
| web | Next.js 16、React 19、Tailwind CSS 4 | major固定、最新security patch |
| API | NestJS 11 | major固定、最新security patch |
| DB | PostgreSQL 18、Prisma 7 GA | image digest/version、manifest |
| cache/queue | Redis 8、BullMQ | image digest/version、manifest |
| API契約 | REST JSON、OpenAPI `/api/v1` | generated contractとの差分検査 |
| deploy | Docker Compose単一host、TLS reverse proxy | environment別設定 |
| mail | capture adapter＋SMTP adapter | production値はenvironment注入 |
| LLM | provider-neutral adapter＋fake adapter＋非AI fallback | production未設定時fail-closed |
| storage | S3-compatible adapter | environment別endpoint |

Patch/minorはPhase 0開始日に互換性とsecurity advisoryを確認し、GA/LTSだけをlockfileとimage digestへ固定する。major変更、architecture変更、外部契約変更はADR対象とする。

## 3. 設計完全性gate

| gate | 根拠 | 状態 |
|---|---|---|
| product scope・MVP境界 | 01、04、14 | PASS |
| AIと人間の判断境界 | 00、02、09 | PASS |
| data model・状態・履歴 | 05 | PASS |
| API資源・error・競合制御 | 06 | PASS |
| Role・Permission・Unit・visibility | 07 | PASS |
| invitation・OTP・password・session | 08 | PASS |
| screen・flow・Empty/error UX | 04、10 | PASS |
| test・security・E2E | 11、13 | PASS |
| backup・retention・incident | 12 | PASS |
| implementation order・DoD | 14 | PASS |
| traceability | 13 | PASS |

## 4. データ分類baseline

| class | 例 | 原則 |
|---|---|---|
| INTERNAL | 制度公開情報、一般設定 | 認証済み対象社員のみ |
| CONFIDENTIAL | 社員master、目標、進捗、共有1on1記録 | Permission、Unit scope、purposeを強制 |
| HIGHLY SENSITIVE | 自己分析、夢、Why、本人の自由記述、未共有1on1準備 | 本人のみを既定とし、明示共有がない限りUL/ADMINも本文閲覧不可 |
| SECRET | password、OTP、token、session、API key、credential | 平文永続化・log・監査本文・client返却禁止 |

客先機密、source code、健康情報、ハラスメント本文、他Member情報はLLM contextへの自動投入を禁止する。緊急・安全上の内容をAIが断定・通報せず、固定の社内外相談導線を表示する。

## 5. 人間だけが完了できる本番移行条件

以下は組織・契約・credentialに関する作業であり、設計およびPhase 0の実装開始を妨げない。実データを扱うproduction公開前には完了必須とする。

1. 法務・個人情報・就業規則上の承認
   - `12-operations-and-retention.md`の保持期間、閲覧主体、退職時処理を担当者が確認する。
   - 承認者、日付、変更点をADRへ記録する。
   - 変更時はdata migration、既存データ、利用者通知への影響を確認する。
2. 緊急・ハラスメント相談導線の確定
   - 社内窓口名、受付時間、連絡手段、休日・緊急時の外部窓口を決める。
   - 表示文を法務・人事が承認し、アプリ設定へ登録する。
   - AIは本文を自動転送せず、本人の明示操作または正式な社内手順に従う。
3. Production LLM契約
   - provider、model、処理region、保存期間、training利用、削除、DPA、障害時運用を確認する。
   - 送信可能なdata classをsecurity/privacy責任者が承認する。
   - API keyはsecret storeへ登録し、repositoryやチケットへ記載しない。
4. Production mail・domain
   - 送信元domain、SMTP/provider、From/Reply-Toを確定する。
   - SPF、DKIM、DMARCを設定し、招待・OTP・resetの到達性を検証する。
   - credentialはsecret storeへ登録する。
5. Hosting・TLS・backup
   - host、domain、network、管理者、監視通知先、暗号化backup先を確定する。
   - RPO 24時間、RTO 8時間を承認するかADRで変更する。
   - restore rehearsalとincident連絡網をproduction公開前に完了する。
6. 初期組織データ
   - 対象事業部、Unit、社員ID、email、role、在籍状態、制度version、KPI、UL Missionを正式情報から準備する。
   - 最小権限で初期ADMINを指定し、投入前に二者確認する。

## 6. 実装開始時の最初の確認

実装担当はrepositoryを再調査し、Design Freezeとの矛盾がないことを確認する。Phase 0ではbaselineのpatch固定、scaffold、CI、local infrastructure、health、empty migrationまでを行い、Phase 1以降を先取りしない。
