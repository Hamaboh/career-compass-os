# 認証・セキュリティ仕様

## 1. Invitation and signup

ADMINが対象事業部employeeを登録して招待する。自由sign-upは禁止。招待tokenと対象emailへのOTPの両方を必要とする。

招待tokenはCSPRNG 128bit以上、DBにはhashだけを保存し、有効48時間、単回利用。再送で旧tokenを失効する。OTPは6桁以上、hash保存、有効10分、最大5試行、再送60秒、単回利用。成功・消費はtransactionで処理する。

## 2. Password

- 8〜128文字
- 英数字のみ可、記号任意
- 前後空白を勝手にtrimしない
- password manager・pasteを妨げない
- confirmationをAPIでも検証
- Argon2id＋random salt
- parameterは本番hostでbenchmark
- password、hash、pepperをlog・audit・responseへ含めない
- login成功時に古いparameterをrehash可能

## 3. Login and lock

通常loginはemail＋passwordのみ。account存在にかかわらず一般化error。email＋IPでrate limitし、連続10回失敗で15分一時lockを既定とする。永続lockはADMIN操作と監査が必要。

## 4. Session

opaque server-side session、HttpOnly、Secure、SameSite=Lax、host-only、Path=/。idle 12時間、absolute 7日。login・権限重要変更でrotate。password変更/reset、EXCLUDED、退職、ADMIN lockで全session失効。Redis障害時はfail closed。

## 5. Password reset

account存在を秘匿した申請response、単回token、hash保存、有効30分、password変更時に全session失効、完了通知、token再利用拒否。秘密の質問は使用しない。

## 6. Web security

- Cookie mutationにCSRF token、Origin/Referer検証
- GETで状態変更しない
- CORS allowlist
- JSON content type強制
- React escaping、raw HTML禁止、必要時allowlist sanitizer
- CSP、HSTS、nosniff、Referrer-Policy、frame制限
- session/tokenをlocalStorageに保存しない
- ORM parameter query、raw SQL review、動的sort/filter allowlist
- endpoint別rate limit

## 7. File security

size、MIME、extension、checksum、malware scanを検証し、scan完了まで非公開。user由来file名をescapeし、inline表示は安全なtypeだけ。客先機密、credential、source codeをuploadしない警告を表示する。

## 8. Secret and logging

`.env`をcommitしない。development/test/productionを分離し、secretはserver/workerだけで利用する。authorization、Cookie、token、password、OTP、AI key、自己分析本文、1on1本文、AI context本文をlogへ出さない。構造化logにはcorrelation IDとsafe metadataだけを含める。

## 9. Threats and controls

| threat | control |
|---|---|
| 招待link盗用 | OTPを対象emailへ送信、単回・期限 |
| account enumeration | 一般化応答、同等処理時間 |
| credential stuffing | rate limit、lock、audit |
| session fixation | login時rotate |
| CSRF | token＋Origin＋SameSite |
| XSS | escape＋CSP＋raw HTML禁止 |
| SQL injection | parameter query＋allowlist |
| IDOR/cross-unit | Guard＋scope＋RLS＋negative test |
| AI data leak | purpose allowlist＋redaction＋visibility |
| Prompt injection | 外部contentをuntrusted data扱い |
| upload malware | quarantine＋scan |
| privileged misuse | permission分離＋audit＋理由 |
