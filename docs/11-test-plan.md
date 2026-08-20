# Test計画

## 1. Quality gates

format、lint、typecheck、unit、component、integration、E2E、build、migration、security、accessibility、secret scan、dependency reviewを必須とする。

## 2. Test layers

| layer | 対象 |
|---|---|
| Unit | 状態遷移、Permission、SMART、Reminder、redaction |
| Component | form、AI card、SMART card、dialog、empty/error |
| API integration | DTO、DB、transaction、auth、RBAC |
| DB | constraint、migration、RLS、index、rollback |
| Contract | OpenAPI、client/server整合 |
| AI schema | structured output、provenance、禁止field |
| AI evaluation | 誘導性、創作、断定、安全、非共有混入 |
| E2E | Member/UL/ADMINの主要journey |
| Security | CSRF、XSS、SQLi、IDOR、rate、session |
| Accessibility | keyboard、screen reader、focus、contrast |
| Recovery | backup/restore、Redis/mail/AI障害 |

## 3. Mandatory E2E

1. ADMIN招待→OTP→password→初回login。
2. OTP期限・試行上限・再利用拒否。
3. 通常loginでOTP不要。
4. password resetで全session失効。
5. 夢がないMemberがexperienceから探索仮説を作る。
6. 明確な目標のshort path。
7. KPI接続なしの目標確定。
8. SMART不足補完と合理的例外。
9. progress→障害→goal revision→旧版保持。
10. Member準備→UL質問review→1on1→Member訂正。
11. 別Unit UL、他Member、EXCLUDEDの拒否。
12. ULのUnit content編集許可と社員編集拒否。
13. 制度新版公開後も旧goalが旧versionを参照。
14. AI timeoutで入力保持・手動完遂。
15. AI提案の採用・修正・却下・保留履歴。

## 4. RBAC matrix

各protected endpointでADMIN、対象Unit UL、別Unit UL、本人Member、他Member、EXCLUDED、未認証、期限切れsession、失効role、異動前後を検証する。APIだけでなくRLS単独のnegative testを含める。

## 5. Security assertions

- password、hash、OTP、token、Cookie、session ID、AI keyがlog/audit/responseにない。
- invitation、OTP、reset tokenは単回。
- CSRFなしmutation拒否。
- upload quarantineとscan。
- raw HTML/AI outputのXSS防止。
- sort/filter/raw SQL injection防止。
- rate limitと一般化auth error。
- EXCLUDED化後の既存session拒否。
- AI Contextに他Member・非共有情報がない。

## 6. AI evaluation dataset

夢なし、外発KPI、矛盾した価値観、曖昧goal、数値化困難goal、外部依存、入力拒否、心理負荷、客先機密、Prompt injection、非共有情報を含む固定caseを用意する。

合格条件は事実創作なし、断定なし、複数候補、根拠、provenance、禁止actionなし、schema適合、共有scope遵守。

## 7. Definition of Done

受入条件、正常・異常・境界test、認可、audit、loading/empty/error、responsive、accessibility、AI fallback、API契約、migration、traceabilityが完了し、全quality gateが成功すること。
