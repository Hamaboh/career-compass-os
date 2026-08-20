# AI入出力・承認契約

## 1. Pipeline

Prompt Version→Context Builder→Safety/Privacy Guard→Provider→schema validation→AI Output→AI Proposal→人間decision→正式domain operation。

## 2. Context contract

Context itemはsource type/ID、provenance、visibility、purpose、owner、Unit、effective version、redaction state、content hashを持つ。purpose allowlistにない情報を追加しない。他Member、非共有情報、失効制度、客先機密を除外する。

## 3. Output contract

全AI出力は以下を持つ。

- `agentType`
- `proposalType`
- `proposal`
- `rationale`
- `evidenceReferences`
- `uncertainties`
- `questionsToConfirm`
- `confidenceBand`（LOW/MEDIUM/HIGH。心理状態の断定に使用しない）
- `safetyFlags`
- `expiresAt`または再評価条件
- `prohibitedAutoActions`

free textだけをdomain dataへ直接mapしない。agentごとのstructured schemaを定義する。

## 4. Decision contract

decisionはACCEPT、EDIT_AND_ACCEPT、REJECT、DEFER。actor、日時、元proposal、修正版、理由を保持する。採用後もAI由来履歴を失わない。

## 5. Agent contracts

| agent | input purpose | output |
|---|---|---|
| self-analysis | 本人の選択session・回答 | 次質問、insight候補、根拠 |
| dream-discovery | 確認済みinsight・経験・制約 | 2〜4仮説、trade-off、探索行動 |
| why-exploration | 対象goal/dreamと本人情報 | 深掘り質問、Why候補、根拠 |
| goal-architect | 本人の意図・Why・方向 | goal階層候補 |
| smart-guidance | goal draft | S/M/A/R/T質問・改善案 |
| smart-audit | immutable goal revision | dimension verdict、理由、不足 |
| evaluation-mapping | 適用制度version＋goal | 接続候補・競合・非接続 |
| progress | check-in・action・期限 | 変化・停滞候補・確認質問 |
| reflection | 結果・経験 | 学び・次変更候補 |
| next-action | goal・障害・機会 | 2〜5 action候補 |
| one-on-one-prep | 共有済み情報 | 変化、論点、質問候補 |
| one-on-one-summary | ULメモ | summary draft・action候補 |

## 6. Forbidden outputs/actions

人事評価、昇降格、給与、配属、採用・解雇、懲戒、適職・性格・心理診断、離職予測、ハラスメント認定、Member ranking、夢・Why・目標の確定、KPI正式解釈、無断共有・通知送信・task確定。

## 7. Failure

timeout、provider rate limit、schema不一致、safety reject、stale context、unauthorized context、conflicting outputを区別する。AI失敗で本人入力を失わず、手動flowへfallbackする。retryはidempotency付きで限定回数とする。

## 8. Evaluation

- 事実創作率
- provenance欠落率
- 本人による修正・却下率
- 禁止断定率
- 非共有情報混入0
- schema成功率
- 重複質問率
- SMART不足理由の有用性
- UL質問採用率
- AI停止時完遂率

採用率だけを品質指標にしない。却下や修正が適切な人間判断である場合を区別する。
