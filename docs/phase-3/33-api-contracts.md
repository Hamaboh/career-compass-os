# Phase 3: API設計

## 1. 原則

- Base pathは`/api/v1`、JSONはUTF-8、日時はUTC ISO 8601。
- すべてのprivate APIでAccess JWT検証、app user状態、permission、Unit scope、機密区分を検証する。
- browser mutationはsame-origin、CSRF、Content-Typeを検証する。
- 入出力をZodで検証し、余剰fieldを拒否する。
- resource IDだけで検索せず、認可scopeを同じqueryへ含める。
- 一覧はcursor pagination、既定25、最大100。
- updateは`If-Match`またはbody versionを要求し、競合は409。
- responseへSecret、token、内部R2 key、非許可本文を含めない。

## 2. エンベロープ

成功:

```json
{"data": {}, "meta": {"requestId": "...", "nextCursor": null}}
```

失敗:

```json
{"error": {"code": "FORBIDDEN_SCOPE", "message": "操作できません", "fieldErrors": []}, "requestId": "..."}
```

内部例外、SQL、stack、AI本文をclientへ返さない。人間向けmessageは情報漏えいを避け、詳細は本文なしのrequest IDで追跡する。

## 3. HTTP状態

| Status | 用途 |
|---|---|
| 400 | 構文・不正遷移 |
| 401 | Access tokenなし/無効 |
| 403 | app user無効、permission/scope/confidentiality拒否 |
| 404 | 存在しない、または存在を秘匿する権限外resource |
| 409 | version競合、重複、状態競合 |
| 422 | field validation、SMART gate不足等 |
| 429 | rate limit、AI予算・操作制限 |
| 503 | AI/メール等の依存障害。手動継続可否をcodeで示す |

## 4. Endpoint一覧

### Identity・組織

| Method/Path | 権限 | 概要 |
|---|---|---|
| `GET /me` | login user | actor、role、Unit scope、capability |
| `GET /units` | UL/EXEC | 自scopeまたは全Unit |
| `GET /units/:id/members` | scoped read | Member一覧 |
| `POST /units/:id/members` | Unit edit | Member登録 |
| `GET/PATCH /members/:id` | scoped read/edit | Member基本情報 |
| `POST /members/:id/unit-histories` | Unit edit | 主所属・兼務履歴 |
| `POST /members/:id/status-histories` | Unit edit | 在籍・休職・退職 |

### 本人理解・目標

| Method/Path | 概要 |
|---|---|
| `GET/POST /members/:id/self-analysis/sessions` | session一覧・開始 |
| `POST /self-analysis/sessions/:id/entries` | 発言/所見を出所付き保存 |
| `GET/POST /members/:id/future-visions` | 将来像版 |
| `GET/POST /members/:id/goals` | 目標一覧・下書き作成 |
| `GET /goals/:id` | 現版と履歴 |
| `POST /goals/:id/versions` | 新版作成 |
| `POST /goal-versions/:id/transition` | 状態遷移 |
| `POST /goal-versions/:id/confirmations` | Member確認証跡 |
| `POST /goal-versions/:id/actions` | 行動追加 |
| `POST /goals/:id/progress` | 進捗記録 |
| `POST /goals/:id/reflections` | 振り返り |
| `POST /goal-versions/:id/policy-links` | 任意制度link |

### 1on1・通知

| Method/Path | 概要 |
|---|---|
| `GET/POST /members/:id/one-on-ones` | 一覧・予定作成 |
| `GET/PATCH /one-on-ones/:id` | 会議情報 |
| `POST /one-on-ones/:id/entries` | 区分付き記録 |
| `GET/POST /reminder-rules` | 目標別周期 |
| `GET /notifications` | actor向け通知 |
| `POST /notifications/:id/read` | 既読 |

### AI

| Method/Path | 状態 |
|---|---|
| `POST /ai/requests/prepare` | scope適用、最小化、匿名化、費用見積りし`AWAITING_UL_APPROVAL` |
| `GET /ai/requests/:id/preview` | ULへ実際の送信予定全文を表示 |
| `PATCH /ai/requests/:id/preview` | 匿名化後本文の編集、再検査 |
| `POST /ai/requests/:id/approve` | hash固定、予算予約、送信 |
| `POST /ai/requests/:id/reject` | 送信せず終了 |
| `GET /ai/requests/:id` | 状態・検証済み結果 |
| `POST /ai/suggestions/:id/decision` | 採用・部分採用・却下。採用先dataを別作成 |

上位役職者は既定でAI prepare/approveを呼べない。request内容変更後は以前の承認を無効化する。

### 共有・制度・レビュー・監査

| Method/Path | 概要 |
|---|---|
| `POST /members/:id/share-snapshots` | allowlistからHTML生成 |
| `POST /share-snapshots/:id/tokens` | 7日既定、30日上限で発行 |
| `POST /share-tokens/:id/revoke` | 即時失効 |
| `GET /s/:rawToken` | public。hash照合後HTML配信 |
| `GET/POST /policy-documents` | 制度一覧・管理者登録 |
| `POST /policy-documents/:id/versions` | 新版登録 |
| `GET/POST /reviews` | review要求・一覧 |
| `POST /reviews/:id/comments` | コメント・差戻し・確認 |
| `GET /audit-events` | actorの許可scopeだけ |

## 5. Public share endpoint

`/s/:rawToken`はAccess対象外の専用routeとし、次をサーバー側で強制する。

- raw tokenをログへ出さずSHA-256等のhashでD1照合
- 128-bit以上の暗号学的乱数
- expiry/revoked/snapshot status確認
- `Cache-Control: private, no-store`、`X-Robots-Tag: noindex, nofollow`
- CSP、`X-Content-Type-Options: nosniff`、frame拒否
- 閲覧イベントはtoken ID、時刻、成功状態だけを監査
- rate limitと不正試行監視

## 6. Idempotency・rate limit

AI実行、share発行、メール、job enqueueは`Idempotency-Key`を受け、actor+operation+keyで一意にする。rate limitはAccess user、IP、operationを組み合わせ、AI prepare/approve、share token試行、export、管理APIを厳しくする。具体値はPhase 4負荷試験で調整し、初期値を設定ファイルへ明示する。

## 7. API versioning

破壊的変更は`/api/v2`またはmedia/schema versionを上げる。AI schema versionと業務API versionを分離する。廃止予定はログ・利用状況を確認し、client切替後に削除する。
