# Admin・incident運用 runbook

## 安全境界

- user、role、Unit scope、AI model policy、retention、backup、quota、incident switchは`SYSTEM_ADMIN`だけが操作する。
- APIとRepositoryの両方でcapabilityを確認し、UI表示を認可根拠にしない。
- 変更理由、request ID、対象、結果だけを監査し、Member本文、Prompt、raw token、Secretを記録しない。
- production resource、外部AI、mail providerをこの実装から操作しない。

## 日次・月次確認

日次はjobの失敗・滞留、直近24時間のbackup、retention candidate、期限切れshare、quotaを確認する。retention scanとbackup exportはidempotency keyを変えずに再試行できる。月次はoperation別AI costとcap率、quota 80%警告、復旧演習の最終成功を確認する。

## AI・共有・mail停止

1. 影響経路と一般化した理由を確認する。
2. AI、share、mailの対象switchを有効化する。全業務書込みを止める場合はmaintenance modeも有効化する。
3. AI request prepare、public share、fake mail dispatch、業務mutationが503で停止し、既存dataの管理閲覧と復旧用admin APIが利用できることを確認する。
4. request ID、開始時刻、影響範囲、判断者をincident記録へ残す。本文やtokenを貼らない。
5. 原因修正とsmoke後に、mail/share/AI、最後にmaintenanceの順で解除する。

## user・role・Unit scope

対象userの現行version、status、role、Unit scopeを取得してから変更する。ULには1つ以上のactive Unit scopeを必須とし、EXECUTIVE/ULから管理APIを呼んだ場合は404境界でconcealする。409時は再読込し、差分と理由を再確認する。最後のactive SYSTEM_ADMINは停止・剥奪できない。

## retention

1. 日次scanで退職・管理対象外から1年経過したMemberと、3年を超えたaudit eventを`CANDIDATE`化する。
2. previewの基準日、件数、関連R2、残す匿名統計、取消不能性、hashを確認する。
3. 一人目のSYSTEM_ADMINが同じhash/versionを承認する。
4. 24時間以内の`READY` backupを確認する。
5. 別のSYSTEM_ADMINが同じhash/versionで実行する。二重実行、古いversion、異なるhashは拒否する。
6. 失敗時は状態と一般化error codeを確認する。R2削除後のDB失敗は同じactionを再開せず、backupとincident手順で復旧判断する。

## quota・observability

Workers、D1、R2の利用率は合成値または管理画面で確認した手入力だけを記録し、自動でpaid planへ変更しない。80%以上を警告、100%で新規負荷を停止する判断を行う。availability、5xx、認可拒否、AI validation/cost、job lag、backup、retentionのmetadataをrequest IDで追跡する。

## rollback

Applicationは直前のreview済みversionへ戻す。migrationは編集・巻戻しせず、新migrationまたは新しいDBへのrestoreを使う。production restore、binding切替、Secret rotationはこのrunbookの自動処理対象外であり、incident責任者と二名のSYSTEM_ADMINによる別承認を必須とする。
