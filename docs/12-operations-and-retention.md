# 運用・保持・復旧仕様

## 1. Environments

development、test、productionを分離し、DB、Redis、object storage、mail、LLM credentialを共有しない。production secretをrepository、image、client bundle、CI logへ含めない。

## 2. Observability

- request/correlation ID
- redacted structured log
- health/readiness
- DB pool、Redis、queue、mail、LLM、storageの状態
- authentication failure・rate limit・権限拒否のalert
- queue retry/dead-letter
- backup成功日時
- migration status
- AI schema/safety failure率

本人の心理内容や自己分析本文をmetric label/logへ使用しない。

## 3. Backup and recovery

PostgreSQL、object storage、設定、migration履歴をbackup対象とする。Redis session/queueは原則再生成可能だが、queue jobの再実行安全性を設計する。

既定目標はRPO 24時間、RTO 8時間とし、本番開始前に組織承認する。月1回以上restore rehearsalを行い、結果を記録する。backupは暗号化し、productionと別failure domainへ保存する。

## 4. Retention defaults

| data | 既定 |
|---|---|
| OTP | 期限後速やかに削除 |
| invitation/reset秘密 | 消費・失効後に秘密部分削除 |
| session | 失効後30日以内に削除 |
| auth event | 1年 |
| audit | 3年 |
| AI raw output | 30日以内または非保存 |
| AI proposal/decision | 関連domainの保持期間 |
| policy version | 参照goalがある限り保持 |
| self analysis/dream/Why | 本人管理、退職・削除policyに従う |
| one-on-one共有記録 | 3年 |
| file | 関連recordと連動 |

上表をengineering defaultとして実装する。本番で実データを投入する前に、会社の法務・個人情報・就業規則上の承認を得る。承認により値を変更する場合はADR、影響分析、data migration計画を必要とする。この組織承認はPhase 0〜開発環境での実装開始を妨げない。

## 5. Lifecycle

退職、休職、異動、EXCLUDED、role変更でsession、assignment、notification、reminder、AI jobを再評価する。異動時に旧Unit ULへ新規閲覧を許可しない。共有済み過去記録の引継ぎはpolicyで限定する。

## 6. Incident

credential漏洩、cross-unit閲覧、AI data leak、malware upload、audit異常、backup失敗をsecurity incidentとして扱う。検知、封じ込め、session/secret失効、影響調査、通知、復旧、再発防止をrunbook化する。

## 7. External dependencies

mail、LLM、object storage、DNS/TLS、backup storageをadapter化する。mail/LLM障害はqueue retryと手動fallbackを提供する。LLM providerには保存・training・region・削除・model versionの契約確認を行う。

MVPの実装baselineは以下とする。

- development/test mail: 外部送信しないcapture adapter
- production mail: SMTP adapter。vendor、送信domain、credentialは本番移行時に設定する
- LLM: provider-neutral server adapter、deterministic fake adapterをtestで使用する。production provider未設定時はAI機能をfail-closedで無効化し、非AI fallbackを使用する
- object storage: S3-compatible API。development/testはcontainer、production endpointはenvironmentで注入する
- TLS: reverse proxyで終端し、development用証明書とproduction証明書を分離する
- backup: 暗号化した別failure domainを本番移行時に指定する

vendor契約やcredentialがなくてもadapter、契約test、fallbackまで実装できるため、外部vendorの最終選定は実装開始条件ではない。
