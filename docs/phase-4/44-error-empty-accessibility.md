# Phase 4: エラー・Empty State・アクセシビリティ・表現

## 1. エラー原則

- 何が起きたか、保存されたか、利用者が次に何をできるかを示す。
- Member名、本文、SQL、stack、token、AI payloadをerrorへ出さない。
- 同じerror codeでも権限外resourceの存在を推測させない。
- AI・メール等の部分障害でアプリ全体を利用不能にしない。
- field errorは対象入力の近く、page errorはsummaryにも表示する。
- error後に入力を失わず、再送による二重処理を防ぐ。

## 2. Error message matrix

| 状態 | 利用者表示 | 次のaction |
|---|---|---|
| Access未認証 | Google Workspace認証へ遷移 | 再ログイン |
| app未登録/停止 | `このアプリを利用する権限がありません` | 管理者連絡 |
| Unit scope拒否 | 対象の存在を明かさない一般表示 | 自分のMember一覧へ |
| 機密ACL拒否 | `この記録は閲覧できません` | 戻る |
| validation | 問題fieldと修正内容 | 入力修正 |
| 409競合 | 他の更新があったことと差分 | 再読込・比較・再適用 |
| AI予算上限 | `AI支援は停止中。手動機能は利用可能` | 手動template |
| AI境界違反 | 応答を使用できない一般理由 | 内容修正・手動 |
| Gmail障害 | 保存済み、通知未送信を分離 | 再送/別手段 |
| R2/share障害 | snapshot状態を明示 | 再生成/HTML download |
| network offline | 未送信と保存済みを区別 | 接続後に手動再試行 |
| 500 | request IDだけ表示 | 再試行/管理者連絡 |

## 3. Empty State

Empty Stateは行動を強制せず、理由と選択肢を示す。

| 画面 | Message・action |
|---|---|
| Memberなし | `このUnitにはMemberが登録されていません` / 登録 |
| 目標なし | 探索、明確な目標、今は作らない |
| 将来像なし | 経験・価値観から仮説を探す / 保留 |
| 1on1なし | 最初の1on1を予定 / 既存メモ登録 |
| 進捗なし | 最初の確認を記録 / 次回日だけ設定 |
| AI提案なし | AIを使う / 手動で続ける |
| 通知なし | `現在、対応が必要な通知はありません` |
| レビューなし | `未対応のレビューはありません` |
| 制度linkなし | `制度との関連付けは任意です` |
| 監査結果なし | filter見直し。権限外件数は表示しない |

## 4. Loading・skeleton

Member名や機密本文を古いcacheから一瞬表示しない。権限検証完了前は汎用skeletonとする。AI処理中は通常の保存が完了しているか分離表示し、無期限spinnerだけにしない。

## 5. Confirmation・destructive action

通常保存に毎回modalを出さない。以下だけ確認を強くする。

- 目標確定・本人確認結果
- AI外部送信
- share URL発行・失効
- role/scope/ACL変更
- 制度版active化
- AI cap/model/Prompt変更
- 匿名化・保持処理
- backup restore

dialog title、対象、結果、取消可能性を示し、buttonは`はい/いいえ`ではなく具体的動詞にする。危険actionを既定focusにしない。

## 6. Accessibility target

WCAG 2.2 Level AAを目標とする。

- semantic HTMLを優先し、不要なARIAを使わない。
- keyboardだけで全操作を完了できる。
- focus indicatorを常に視認可能にし、sticky header/dialogで隠さない。
- skip link、landmark、論理的heading、page titleを用意する。
- formはvisible label、description、required、errorを関連付ける。
- 色だけで状態を伝えず、text/iconを併用する。
- text contrast 4.5:1、large text 3:1、UI component 3:1を基準とする。
- 200% zoomとreflowで主要操作を失わない。
- target sizeは原則24×24 CSS px以上を下限とし、実用上44×44相当を推奨する。
- animationは必要最小限、`prefers-reduced-motion`に対応する。
- timeout、autosave、AI完了、errorは適切なlive regionで通知し、過剰読上げを避ける。
- dragだけの並べ替えを作らず、button/keyboard代替を用意する。

WAI-ARIA APGのdialog、tabs、table等を参照するが、illustrative exampleを無検証でproductionへコピーしない。

## 7. Form accessibility

- placeholderをlabel代替にしない。
- error summaryは先頭へfocusし、各fieldへlinkする。
- 入力値をerrorで消さない。
- 同じ情報の再入力を求めず、既存値を編集可能に提示する。
- 日付はformat例を明記し、calendar操作なしでもkeyboard入力できる。
- SMART status、provenance、confidentialityはscreen reader向けtextを持つ。
- icon buttonにはaccessible nameを付ける。

## 8. Complex component

- tableはnative tableを優先し、interactive gridは必要時だけ。
- tabsはarrow key、selected state、panel関係を実装する。
- modalはfocus trap、初期focus、Escape、閉じた後のfocus復帰を持つ。
- toastだけに重要情報を置かず、履歴やpage内状態にも残す。
- tooltipだけで必須説明を提供しない。

## 9. 日本語表現

- 人を評価・責める表現を避け、観察可能な状態を示す。
- `未達`だけでなく`期限・内容を確認`とする。
- `AIが判断しました`ではなく`AIが候補を提示しました`。
- `あなたのWhy`と断定せず`本人確認前のWhy候補`。
- `低い納得度`を警告せず`本人の現在の自己申告`。
- 制度・AI用語には短い平易な説明を併記する。

## 10. 本人向けHTML

- `lang="ja"`、論理heading、print stylesheet。
- JavaScriptなしでも全内容を読める。
- link purposeが明確で、URLだけを読ませない。
- 外部font、tracking、analytics、埋込みmediaを使わない。
- print時もstatusを色だけに依存しない。
- 画面幅と印刷の両方で表が欠落しない。

## 11. 公式参照

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)
- [WAI keyboard interface practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
