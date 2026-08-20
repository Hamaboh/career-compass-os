# Phase 4: UI/UX設計・開発計画

## 1. UX原則

ユーザーに考えさせすぎないが、AIが勝手に決めすぎない。一度の主質問は原則1件、最大3件。回答済み情報を再入力させず、長いflowは下書き保存・中断・再開可能にする。

AI提案は本人入力・確認済み情報・UL所見・制度・計算結果と視覚的に区別し、根拠を表示する。採用、修正採用、却下、保留を提供する。

## 2. Navigation

### Member

ホーム、キャリア、目標、1on1、通知、プロフィール。

### UL

Member機能に加え、ULホーム、メンバー、1on1管理、Unit状況、Unit支援コンテンツ。

### ADMIN

個人workspaceと管理workspaceを分離。社員、Unit、権限、招待、制度、KPI、Mission、設定、AI設定、監査。

## 3. Screen inventory

### Authentication

ログイン、招待確認、OTP、password設定、登録完了、password reset申請・実行、招待無効、account停止、session期限切れ。

### Member

dashboard、初回状態確認、career home、自己分析、経験、強み・価値観・関心、夢・将来像探索・詳細、Why、career direction、目標一覧・作成・SMART・review・詳細、行動、progress、evidence、reflection、goal revision、1on1 home・事前準備・結果確認、通知、プロフィール、共有範囲。

### UL

dashboard、自Unit Member一覧、Member支援詳細、目標状況、1on1一覧・準備・AI質問・記録・review、目標修正提案、課題・次action、UL支援task、Unit状況、Unit向けcontent編集。

### ADMIN

dashboard、社員一覧・詳細、Unit、権限、招待、制度一覧・version、KPI、Mission、評価観点、アプリ設定、AI設定、通知template、監査一覧・詳細、file管理。

詳細は[`10-ui-screen-specification.md`](10-ui-screen-specification.md)。

## 4. Goal creation UX

開始方法を選択する。

1. 目標がないので一緒に考える。
2. 方向性はあるが具体化したい。
3. 明確な目標をSMART化したい。
4. KPI・Missionから考えたい。

基本flowは自己理解確認→将来像→Why→通過点→任意KPI/Mission→SMART誘導→行動→SMART監査→確定前review→本人承認→保存。

確定前reviewでは目標、Why、将来像、制度接続、SMART、行動、証拠、期限、確認周期、支援、共有範囲、例外を確認し、section単位で戻れる。

## 5. SMART UI

S/M/A/R/TごとにOK、要改善、不足をlabelとiconで表示する。不足理由、影響、必要情報、質問、修正候補、手動入力、後で考えるを提供する。例外確定は理由、代替条件、再確認日、必要時UL確認を要求する。

## 6. 1on1 UX

Member事前準備は5分以内で、話したいこと、進んだこと、困り事、納得感変化、ULへの支援希望、共有範囲を入力する。

UL準備はMember希望→重要変化→前回合意→本人自己評価→目標progress→障害→成果→AI確認候補→修正候補→次actionの順。AI質問は最大5件を既定とし、ULが採用・編集・却下する。

MVPで常時録音・real-time AI介入はしない。終了後summaryはdraftで、UL確認後Memberへ共有し、Memberが訂正できる。

## 7. Dashboard

Memberは今日の最優先を最大3件、次action、期限、1on1、確認待ち、成果、AI提案を表示する。対応不要状態も明示する。

ULはrankingではなく支援queueとして、相談希望、1on1、UL未完了task、期限、変化候補、目標修正候補、成果を表示する。

ADMINは運用・security・制度状態を表示し、個人の機微情報を集約しない。

## 8. Error and Empty State

errorは何が起きたか、入力保持、次の操作、retry可否、correlation IDを示す。AI timeoutでは手動継続を提供する。version競合では差分を表示する。

Empty Stateは未達を責めず、夢がなくても問題ない、経験1つから始められる等の開始案内を提供する。

## 9. Notification

行動、中間確認、振り返り、1on1、SMART再確認、期限、更新、本人確認待ちを対象にする。目標別周期、quiet hours、digest、snooze、個別停止、理由表示、重複抑制を提供する。

## 10. Accessibility

- keyboard完結
- focus可視化
- semantic HTML
- label・error関連付け
- screen readerで状態を理解可能
- 色だけに依存しない
- contrast基準
- reduced motion
- mobile touch target
- timeout延長・再認証後復帰

## 11. Delivery order

0. 仕様・基盤
1. DB・認証・認可
2. 制度・ADMIN
3. 自己分析・キャリア
4. 目標形成・SMART
5. 継続支援
6. 1on1・UL
7. dashboard・通知
8. 横断UX・security・運用

詳細は[`14-implementation-roadmap.md`](14-implementation-roadmap.md)。

## 12. UX acceptance

- 夢がない人が5分以内に探索を始められる。
- 明確な目標を持つ人が自己分析を強制されない。
- すべてのAI提案を拒否・修正・保留できる。
- 1分程度でprogress check-inできる。
- ULが10分以内に1on1準備をreviewできる。
- 非共有情報がUL画面へ表示されない。
- AIが停止しても主要操作を続けられる。
