# Phase 3: セキュリティ・プライバシー・脅威モデル

## 1. 保護対象

- Memberの自己理解、目標、Why、1on1、進捗、成果
- UL非公開メモ、機密記録、AI送信禁止情報
- 利用者identity、role、Unit scope
- 会社制度資料と版
- AI匿名化対応、Prompt、利用量、承認証跡
- Share token、R2 object、OAuth/Cloudflare Secret
- 監査、backup、retention action

## 2. 主な脅威と統制

| 脅威 | 統制 |
|---|---|
| Access header偽装 | JWT署名、iss、aud、期限をWorkerで検証 |
| ULの他Unit越境 | query時scope predicate、central policy、negative test |
| Executiveによる元データ編集 | capability拒否、UI非表示だけに依存しない |
| 機密1on1漏えい | confidentiality + record ACL + field filtering |
| IDOR | opaque ID、resource+scope同時query、404秘匿 |
| SQL injection | prepared/bound query、入力schema、raw SQL制限 |
| XSS | React escape、sanitize済みrich text、CSP、inline script禁止 |
| CSRF | Origin/Fetch Metadata/CSRF token、same-origin CORS |
| Share URL漏えい | high-entropy token、hash保存、期限、失効、no-store、rate limit |
| R2直接公開 | private bucket、Worker binding経由、object key非公開 |
| AIへのPII漏えい | scope→allowlist→匿名化→UL preview→送信→応答検査 |
| Prompt injection | 外部文書をdataとして分離、tool権限なし、構造schema |
| Secret漏えい | Workers Secrets、環境分離、ログredaction、rotation |
| backup漏えい | private R2 prefix、system admin限定、暗号化、復旧監査 |
| 過剰ログ | 本文/Prompt/token/SQL bind値を一般ログへ出さない |
| 依存関係侵害 | lockfile、Dependabot、CI audit、最小dependency |

## 3. XSS・HTML

自由記述はplain textを既定とする。Markdownを許可する場合はHTMLを無効化し、allowlist sanitizerをサーバー側でも適用する。共有HTMLは固定templateへescape済み値を埋め込み、任意script、event handler、iframe、外部画像、外部fontを含めない。

Security headerの最低要件:

- `Content-Security-Policy`（`default-src 'self'`を基点に最小許可）
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`（share）、通常画面もstrict policy
- `Permissions-Policy`でcamera/microphone/geolocation等を拒否
- `frame-ancestors 'none'`

## 4. 暗号化・Secret

通信はHTTPS。D1/R2のprovider側暗号化に加え、匿名化対応表や保持が必要なAI本文はアプリケーションレベルenvelope encryptionを検討し、鍵をWorkers Secretで管理する。鍵versionをcipher metadataへ記録し、rotationできるようにする。Secretを`NEXT_PUBLIC_`、GitHub、D1、ログ、error responseへ入れない。

## 5. AI固有統制

- AI Gateway/Providerの学習不使用・保持条件をPoCと契約確認で記録する。
- Prompt本文loggingはOFFを既定とする。
- 外部AIへ直接D1/R2/Google APIアクセス権を与えない。
- AI responseのURL、命令、コードを自動実行しない。
- AI出力はuntrusted inputとしてschema、文字数、PII、禁止判断を検査する。
- 月額capをapplication側ledgerでも強制し、provider側budget alertと二重化する。
- AI停止switchはoperation別と全体の2段階を持つ。

## 6. Audit設計

監査対象:

- login成功/拒否、app user無効拒否
- role/scope/ACL変更
- Member、所属、状態、目標、確認、1on1、制度の重要変更
- 機密記録閲覧と拒否
- AI prepare/承認/送信/応答採否/境界違反/予算停止
- share発行/閲覧/失効
- export、backup、restore、retention/anonymization
- admin保守操作

監査eventはappend-only application policyとし、更新APIを提供しない。metadataはfield名、旧/新版番号、結果code等に限定し、本文、raw token、Prompt、Secretを含めない。3年保持し、閲覧自体も監査する。

## 7. Rate limit・abuse

Access user単位、IP単位、operation単位で制限する。public share tokenの404/410差を必要以上に公開せず、不正token試行を遅延・遮断する。AI、export、制度upload、admin変更は厳しいlimitとidempotencyを適用する。Cloudflare WAF/rate limitingの有料機能に依存する部分はplan決定時に確認し、未利用でもapplication limitを持つ。

## 8. 添付・upload

MVPで添付を許可する場合、種類、size、件数をallowlist化し、拡張子だけでなくContent-Typeとmagic bytesを確認する。object keyはrandom、元filenameは表示metadata、downloadは認可Worker経由。HTML/SVG/script実行可能形式は既定禁止。malware scanが用意できない間はPDF・画像も最小限とし、外部公開しない。

## 9. Incident response

1. Access policyまたはapp userを停止する。
2. share token、AI operation、mail job等の影響経路を停止する。
3. 本文を露出しない監査・provider logsでscopeを特定する。
4. Secret/tokenをrotationする。
5. D1 Time Travel/R2 backupから必要時復旧する。
6. 原因、影響、再発防止、判断者を記録する。

個人データ漏えい時の会社内連絡先、法的報告要否は会社責任者が実装前に定める。

## 10. Security acceptance

- role/Unit/confidentialityのdeny testがAPIごとに存在する。
- forged/expired/wrong-aud JWTを拒否する。
- CSRF、stored/reflected XSS、SQLi、IDOR、share token brute forceを試験する。
- PII/社内語がAI送信payloadと一般ログへ出ない。
- production Secretがrepository、build artifact、client bundleへ含まれない。
