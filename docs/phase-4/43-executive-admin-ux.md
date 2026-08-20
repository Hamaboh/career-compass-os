# Phase 4: 上位役職者・システム管理者UX

## 1. 上位役職者ホーム

目的は人の順位付けではなく、全Unitの運用状況とULへの支援必要性を把握すること。

### 表示するもの

- UnitごとのMember数と対象期間
- 目標の本人確認待ち件数
- 長期未更新件数
- 1on1予定・実施状況
- レビュー未対応件数
- 通常記録から確認可能な課題
- 参考退職率。算出不能、暫定rule、期間を明記

### 表示しないもの

- AIによるMember/UL ranking
- 離職予測、意欲推定、心理状態
- 機密記録の本文・存在詳細
- 未承認AI仮説を確定事実として扱う集計
- 人事評価・給与の確定値

## 2. Unit比較

比較表は期間、分母、計算rule versionを表示する。小数第1位まで表示し、第2位以下切捨て。平均人数0では退職率を`算出不能`とし0%表示しない。

8名以上のUnit判定は平均人数8.0以上。休職者除外、兼務は主所属だけ、Unit異動は退職に含めない。画面上に`参考情報であり正式評価ではありません`を常設する。

## 3. レビュー受信箱

filter:

- 未確認
- コメント中
- 差戻し
- UL対応済み
- 確認済み
- Unit、対象種別、更新日

レビュー詳細には対象version、ULの内容、過去コメントを表示する。主要actionは以下のみ。

- コメント
- 修正依頼として差戻し
- 対応を確認済みにする

目標本文、本人発言、1on1本文の直接編集buttonを置かない。差戻しは「人事評価上の不合格」ではなく、確認したい点・修正理由を記述する。

## 4. 機密アクセス

通常記録と機密記録を混在表示しない。ACLがない場合はAPIが本文を返さず、UIは一般的なアクセス不可表示にする。SYSTEM_ADMINも運用roleだけで機密本文を当然に読めない。

明示ACLを付与する場合:

- 対象記録
- 利用者
- 目的
- 有効期限
- 付与者
- 確認dialog
- 監査記録

を必須にする。

## 5. 管理者ホーム

優先順位:

1. 利用不能・securityに関する警告
2. AI費用80%/100%、AI停止状態
3. backup/export失敗、復旧テスト期限
4. stuck job、mail失敗
5. 利用者・scopeの未設定
6. retention candidate
7. 制度版の適用期限

個人内容をdashboardへ表示しない。

## 6. 利用者・Role・Unit scope管理

一覧:

- Workspace email、表示名
- app状態
- role
- Unit scope
- 最終ログイン
- 更新日

変更flow:

1. 対象者と現在権限を表示。
2. role/scopeの変更差分を表示。
3. 影響する閲覧・編集範囲を自然文で説明。
4. adminが変更理由を入力。
5. 確認dialogで再確認。
6. 保存後に監査event IDを表示。

自分自身の最後のSYSTEM_ADMIN権限を外せない。全Unit scopeをULへ誤付与しない。停止は次requestから反映する。

## 7. Unit・Member初期管理

Unit統合・分割・廃止は既存recordを上書きせず、新しい有効期間を作成する。影響するMember、UL scope、評価期間、未完了目標をpreviewする。大量変更はdry run reportを確認してから行い、即時破壊操作を避ける。

## 8. 制度資料管理

個人評価制度とUnit Leaders Missionを別tab/sectionに分離する。

版登録:

- 原本名・参照先
- 制度種別
- 版番号
- 適用開始・終了
- status: draft / active / retired
- checksum
- 登録者
- 項目preview

過去goal linkへの影響を`0件/件数`で表示し、新版登録で過去linkを変更しない。Management categoryだけdraftであることを項目単位で表示する。

## 9. AI管理

表示:

- 今月利用額、上限1,000円相当、80%警告、残額
- operation別利用量・成功率・validation違反
- model/provider、Prompt/schema version
- 学習不使用・保持条件の確認状態
- 全体/operation別停止switch
- 最近のboundary violation。本文は非表示

上限引上げ、高価格model追加、Prompt active化は理由と確認を必須にし、無断fallbackを作らない。AI停止後も手動機能が使えることをpreviewする。

## 10. 監査ログ

検索軸:

- 期間
- actor
- Unit
- event type
- subject type
- outcome
- request ID

一覧に本文、raw share token、Prompt、Member自由記述を表示しない。監査eventから対象画面へ遷移する場合も現在のrole・scope・機密ACLを再検証する。

## 11. 保持・匿名化

candidate画面には基準日、対象データ種別、削除/匿名化件数、残す統計、関連R2、取消不能部分を表示する。実行前にexport/recovery条件を確認し、二者確認を推奨する。buttonは`削除`ではなく`匿名化内容を確認`→`匿名化を実行`の二段階にする。

## 12. 運用画面

- Cron最終成功
- job queue、attempt、stuck/dead
- Gmail送信成功・失敗。本文非表示
- D1 Time Travel確認
- 日次R2 export
- 月次復旧演習
- Workers/D1/R2 quota

復旧操作は通常画面と分け、maintenance mode、restore point、影響、現状保全export、事後検証のrunbookを順に確認する。
