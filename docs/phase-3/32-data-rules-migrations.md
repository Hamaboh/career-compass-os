# Phase 3: データ整合性・計算・Migration設計

## 1. トランザクション境界

D1のprepared statementとbatch transactionを使い、次を原子的に処理する。

- 目標新版作成、旧版のsuperseded化、current version更新、監査記録
- Member確認結果、目標状態遷移、監査記録
- 共有snapshot、token hash、監査記録
- AI実行可否の予算予約、request状態更新、ledger記録
- job claim、処理結果、outbox更新

R2や外部APIはD1 transactionへ含められない。先にD1で`PENDING`を作り、外部処理後に`READY/SUCCEEDED`へ進めるSaga/outboxとし、失敗時は再試行または補償削除する。

## 2. 業務不変条件

- Active ULの編集scopeは必ず1つ以上の有効Unit割当を持つ。
- 同一Memberの同一日に主所属Unitは最大1つ。
- 兼務Unitは人数・退職率の分母へ加算しない。
- 休職期間と評価期間の期首・期末が重なる場合、その時点の人数から除外する。
- 会社退職イベントだけを退職者数へ計上し、Unit異動は除外する。
- 平均人数0は`calculable=false`、退職率NULL。
- `member_confirmed`以降への遷移にはconfirmation recordが必要。
- 制度linkは同一policy item versionへ固定する。
- `AI_SEND_PROHIBITED` entryはAI context参照へ入れられない。
- Share snapshotは確定済み情報のallowlistだけから生成する。

## 3. 決定論的計算

### 3.1 退職率

```text
start_count = 期首時点で主所属かつ在籍、非休職の人数
end_count   = 期末時点で主所属かつ在籍、非休職の人数
average_raw = (start_count + end_count) / 2
turnover_raw = leaver_count / average_raw * 100  // average_raw > 0のみ
display = floor(turnover_raw * 10) / 10
```

再入社しても過去の退職イベントを取り消さない。Unit統合・分割では期間末主所属を評価対象Unitとする暫定ルールをrule versionとともに保存する。

### 3.2 営業日

日本の土日と祝日を除外する。祝日データは年単位のversioned calendarとして取り込み、計算結果にcalendar versionを記録する。交通費期限は対象月翌月の第2営業日。AIで計算しない。

### 3.3 24時間応答

ULが連絡日時と応答日時/未応答を記録した場合だけ参考イベントを算出する。Slack・メール監視やAI推定をしない。

## 4. 競合制御

D1はDB単位でwriteを逐次処理するが、利用者の編集競合は失われる可能性がある。更新可能resourceに`version`整数を持たせ、`WHERE id=? AND version=?`でoptimistic lockingする。0件更新時は`409 VERSION_CONFLICT`とし、最新値と差分確認を促す。

外部送信、share発行、通知は`dedupe_key` uniqueで二重処理を防止する。AI予算は見積額を`RESERVED`として先に計上し、完了時に実額へ精算する。

## 5. Migration

- SQL migrationを連番・不変ファイルとしてGit管理する。
- 適用済みmigrationを編集せず、新migrationで修正する。
- destructive migrationはexpand → backfill → switch → contractに分割する。
- production前にpreviewの本番同等schemaと合成データで適用・rollback手順を検証する。
- D1 Time Travel bookmarkと日次exportを確認してからproduction migrationを行う。
- migrationはアプリの対応versionと順序を記録し、旧Workerが新schemaで破損しないよう後方互換期間を設ける。

## 6. Seed・初期データ

コードに実名・メール・Unit名・制度本文をseedしない。リポジトリに置けるseedはrole、permission、enum相当の非秘密マスタだけとする。利用者、Unit、Member、制度は管理者の手入力または承認済みimportで登録し、import actorとchecksumを監査する。

## 7. D1制約への対応

- 1 statementのbound parameterやrow sizeを超える自由記述・添付はR2へ移す。
- bulk処理は小さいpageへ分割し、job checkpointを持つ。
- N+1を避け、必要列だけをprepared statementで取得する。
- read replicaを初期MVPで前提にしない。
- SQL文字列連結は禁止し、常にbind parameterを使う。

## 8. データ検証ジョブ

日次で、孤立参照、期限切れshare、scope不整合、未精算AI予約、stuck job、保持期限到来を検出する。自動修復は期限切れshare拒否やlease解放等の安全なものに限定し、業務データの修正・本人確認状態変更は管理者レビュー対象とする。
