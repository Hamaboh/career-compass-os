# Backup・restore runbook

## Scope

日次D1 export、Private R2の30日保持、RPO 24時間、RTO 1営業日の復旧手順を定義する。本番操作はSYSTEM_ADMIN二者確認と会社のincident責任者承認後だけ実施する。Secret、個人データ、raw tokenをissue・PR・chat・一般ログへ貼らない。

## Daily backup

1. 対象環境、D1 database、Private R2 backup prefixを確認する。
2. D1 Time Travelが30日を満たす場合はbookmarkを記録する。満たさない場合はD1 exportを取得する。
3. schema version、主要table件数、R2参照key、source timestampをmanifest化する。
4. exportとmanifestを通常application readから分離したPrivate R2 prefixへ保存する。
5. checksumを照合して`READY`にし、30日後のexpiryを記録する。
6. `BACKUP_EXPORT_READY`監査eventと失敗時の一般化error codeを確認する。

## Preview restore exercise

本番dataをpreviewへコピーしない。合成dataのbackupだけを使用する。

ローカルで再現する場合はNode/pnpmのinstall後に次を実行する。

```sh
python3 scripts/test-admin-operations.py
```

この検査は全migrationを空のSQLiteへ適用し、合成dataを実fileへbackupし、別connectionでrestoreして主要件数とforeign keyを検証する。さらに経過時間がRTO 1営業日以内であることを確認する。外部Cloudflare resource、credential、production dataは使用しない。

1. previewをmaintenance modeにし、書込みを停止する。
2. 復旧対象export、source timestamp、checksum、schema versionを確認する。
3. 現在状態の保全exportを別prefixへ作成する。
4. 新しいpreview D1へexportをimportする。既存DBを直接上書きしない。
5. migration version、主要table件数、foreign key、R2参照を検証する。
6. SYSTEM_ADMIN、EXECUTIVE、UL、他Unit、CONFIDENTIAL拒否の認可smokeを実行する。
7. RPOとRTOを計測し、24時間・1営業日以内か記録する。
8. smoke成功後だけbindingを切り替え、maintenance modeを解除する。
9. `restore_exercises`と監査eventに本文を含まない結果を保存する。

## Production recovery

1. Incident責任者と異なる2名のSYSTEM_ADMINがrestore pointと影響範囲を確認する。
2. maintenance mode、AI/share/mail incident switchを有効化する。
3. 現状の保全exportを作り、checksumと保存先を確認する。
4. D1 Time Travelまたはreview済みexportから新しいDBへ復旧する。
5. schema、件数、整合性、R2、認可、health、主要業務flowを検証する。
6. 問題があればbindingを切り替えず、旧環境を維持する。
7. 成功時のみbindingを切り替え、段階的にincident switchを解除する。
8. 判断者、restore point、RPO/RTO、検証、残課題を監査・incident記録へ残す。

## Rollback

Applicationだけの障害は直前のreview済みWorkers versionへrollbackする。DB migrationは既存migrationを編集せず、後方互換migrationまたは新DBへのrestoreで復旧する。匿名化済みデータは直接復元せず、実行前backupから会社責任者承認下で復旧判断する。
