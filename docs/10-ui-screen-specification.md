# UI画面仕様

## 1. Common component

App Shell、workspace switcher、breadcrumb、page title、status badge、primary action、help、timeline、AI proposal card、provenance badge、share scope selector、draft indicator、filter、cursor pagination、loading skeleton、empty state、error boundary、confirmation dialog、unsaved guard、accessible toast。

AI proposal cardは提案、理由、根拠、不確実性、生成日時、採用、修正採用、却下、保留、報告を含む。

## 2. Authentication screens

| ID | 画面 | 主component・状態 |
|---|---|---|
| AU-01 | Login | email、password、表示切替、reset。自由登録なし |
| AU-02 | Invitation | masked email、会社、期限、OTP送信 |
| AU-03 | OTP | paste可能入力、残時間、再送、試行error |
| AU-04 | Password setup | 8文字以上、strength、confirmation |
| AU-05 | Complete | 登録完了、dashboardへ |
| AU-06/07 | Password reset | 申請、一般化応答、再設定 |
| AU-08 | Invalid invitation | 期限切れ・取消、再招待案内 |
| AU-09 | Account unavailable | lock/EXCLUDEDの安全な案内 |
| AU-10 | Session expired | 再login、下書き復帰 |

## 3. Member screens

| ID | 画面 | 目的・主要component |
|---|---|---|
| ME-01 | Dashboard | 最優先最大3、次action、期限、1on1、確認待ち、成果 |
| ME-02 | Initial state | 目標・方向・経験の有無から開始点選択 |
| ME-03 | Career home | 自己理解→夢→Why→方向の状態 |
| ME-04 | Self analysis | 主質問1件、回答、整理panel、共有scope、中断 |
| ME-05 | Experiences | 状況・行動・結果・感情・学び・証拠 |
| ME-06 | Insights | 強み・価値観候補、根拠、採否 |
| ME-07/08/09 | Dreams | 一覧、探索、仮説詳細、試行、confidence |
| ME-10 | Why | 本人原文、根拠、関連experience/value/dream |
| ME-11 | Career direction | 複数方向、trade-off、status |
| ME-12 | Goals | draft/active/review/completed filter |
| ME-13/14 | Goal creation | 開始方法、対話wizard、下書き |
| ME-15 | SMART | dimension別OK/改善/不足、補完、例外 |
| ME-16 | Final review | Why、階層、制度、SMART、action、evidence、共有、承認 |
| ME-17 | Goal detail | connection map、timeline、progress、revision |
| ME-18 | Actions | owner、期限、status、証拠 |
| ME-19 | Check-in | 進んだこと、障害、次action、相談、1分UX |
| ME-20 | Evidence | description、file、goal接続、visibility |
| ME-21 | Reflection | outcome、学び、次変更、継続判断 |
| ME-22 | Goal revision | 変更理由、影響差分、旧版保持 |
| ME-23/24/25 | One-on-one | home、5分事前準備、結果確認・訂正 |
| ME-26/27 | Notification | center、quiet hours、digest、snooze |
| ME-28/29 | Profile/share | 最小profile、visibilityの一元確認 |

## 4. UL screens

| ID | 画面 | 目的・主要component |
|---|---|---|
| UL-01 | Dashboard | 相談希望、1on1、UL未完了task、変化候補 |
| UL-02 | Members | 自Unit、次回1on1、共有状態、相談、支援task。ranking禁止 |
| UL-03 | Support detail | 共有summary、変化、goal、成果、1on1、UL action |
| UL-04 | Goal status | 目標別状態、期限、障害、修正候補 |
| UL-05/06 | One-on-one list/prep | 予定、Member希望、前回差分、準備sheet |
| UL-07 | AI questions | 最大5、目的、根拠、優先度、採用・編集・却下 |
| UL-08/09 | Record/review | memo、合意、summary draft、共有 |
| UL-10 | Revision proposal | 差分、影響、本人確認待ち |
| UL-11/12 | Issues/actions | Member actionとUL actionのowner分離 |
| UL-13 | Unit status | 個人rankingなし、支援量・期限・相談状況 |
| UL-14 | Unit content | Unit向けtemplate。社員・全社設定不可 |

## 5. ADMIN screens

| ID | 画面 | 目的・主要component |
|---|---|---|
| AD-01 | Dashboard | account、invite、制度、security、運用状況 |
| AD-02/03 | Employees | 最小社員情報、Unit、role、状態、影響確認 |
| AD-04 | Units | 階層、membership、UL、有効期間 |
| AD-05 | Access | role/permission/scope、差分、重要変更確認 |
| AD-06/07 | Invitations | 状態、期限、再送、取消 |
| AD-08/09 | Policies | document、immutable version、差分、公開workflow |
| AD-10 | KPI | 説明、基準、期間、能力、scope |
| AD-11 | UL Mission | 目的、基準、scope、期間 |
| AD-12 | Criteria | 評価観点 |
| AD-13 | App settings | organization運用設定 |
| AD-14 | AI settings | agent、provider、data class、retention、rate |
| AD-15 | Notification template | system通知template |
| AD-16/17 | Audit | safe metadata、filter、detail、export制限 |
| AD-18 | Files | scan、分類、version、download audit |

## 6. Empty and error

夢がない場合は「明確な夢がなくても問題ありません」。目標がない場合は経験または現在の課題から開始する。権限errorは他resourceの存在を漏らさない。AI errorでは入力保持と手動継続を示す。version conflictでは差分を表示する。

## 7. Responsive

mobileはcheck-in、通知、1on1準備、短い対話を優先。PCは目標階層、制度管理、UL/ADMIN table、差分reviewを優先する。全主要flowは両方で完遂可能にする。
