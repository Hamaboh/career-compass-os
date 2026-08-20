# Phase 5: 全要件トレーサビリティ

## 1. 読み方

各Phase 1要件を、主要設計、実装slice、受入testへ対応づける。文書番号は`docs/phase-N/NN-*.md`の先頭番号を示す。

## 2. 機能要件

### 認証・利用者

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-AUTH-001 | `30`,`34`,`40` Access+Workspace | I1 | E2E-01、JWT |
| FR-AUTH-002 | `31`,`34`,`40` app user status | I1 | 未登録/停止deny |
| FR-AUTH-003 | `34`,`35` role/Unit/confidentiality | I1 | negative matrix |
| FR-AUTH-004 | `34`,`40`,`43` scope | I1/I2 | UL/EXEC matrix |
| FR-AUTH-005 | `34`,`43` EXEC read/review only | I1/I8 | E2E-09 |

### Unit・Member

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-MEM-001 | `31`,`33`,`40`,`41` | I2 | E2E-02 |
| FR-MEM-002 | `31`,`32`,`43` histories | I2 | status boundary |
| FR-MEM-003 | `03`,`32` primary only | I2/I8 | turnover cases |
| FR-MEM-004 | `31`,`32` immutable history | I2 | move/leave/return |
| FR-MEM-005 | `34`,`40`,`43` global read | I1/I2 | EXEC matrix |

### 本人理解・将来像

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-SELF-001 | `21`,`31`,`41` domains | I3 | E2E-03 |
| FR-SELF-002 | `20`,`31`,`41` provenance | I3 | provenance unit |
| FR-SELF-003 | `21`,`31` hypothesis/status | I3 | state test |
| FR-SELF-004 | `21`,`41` unanswered/refusal | I3 | empty/hold |
| FR-SELF-005 | `21`,`41` shortcut | I4 | E2E-04 |

### 目標・Why・行動

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-GOAL-001 | `21`,`31`,`41` hierarchy | I4 | E2E-03/04 |
| FR-GOAL-002 | `21`,`41` policy optional | I4 | no-link goal |
| FR-GOAL-003 | `31`,`41`,`43` fixed version link | I4/I8 | E2E-12 |
| FR-GOAL-004 | `21`,`31`,`41` SMART axes | I4 | SMART boundary |
| FR-GOAL-005 | `31`,`41` criteria/date/cadence | I4 | validation |
| FR-GOAL-006 | `21`,`31`,`32` lifecycle | I4 | transition matrix |
| FR-GOAL-007 | `31`,`32`,`41` new version/diff | I4 | E2E-11 |
| FR-GOAL-008 | `03`,`32`,`41` confirmation gate | I4 | E2E-05 |

### AI

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-AI-001 | `20`,`23`,`42` QUESTION_PLAN | I6 | golden set |
| FR-AI-002 | `20`,`21`,`42` Why proposal | I6 | provenance |
| FR-AI-003 | `21`,`23`,`41` SMART_AUDIT | I6 | golden set |
| FR-AI-004 | `23`,`24`,`42` prep | I6 | E2E-07 |
| FR-AI-005 | `23`,`24`,`42` post | I6 | E2E-07 |
| FR-AI-006 | `22`,`23`,`33`,`42` preview/approve | I6 | approval bypass |
| FR-AI-007 | `22`,`31` send policy | I6 | prohibited exclusion |
| FR-AI-008 | `20`,`23`,`31` separate suggestion | I6 | persistence test |
| FR-AI-009 | `23`,`31`,`43` version/usage/decision | I6/I9 | audit/ledger |
| FR-AI-010 | `25`,`31`,`42`,`43` cap | I6/I9 | 80/100 boundary |
| FR-AI-011 | `20`,`42`,`46` manual fallback | I3〜I7 | E2E-06 |

### 1on1

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-1ON1-001 | `24`,`31`,`42` | I5 | E2E-07 |
| FR-1ON1-002 | `22`,`31`,`34`,`42` | I5 | E2E-08 |
| FR-1ON1-003 | `24`,`42` delta | I5/I6 | E2E-07 |
| FR-1ON1-004 | `24`,`31`,`42` next date | I5 | reminder test |
| FR-1ON1-005 | `34`,`43` normal/ACL | I1/I5 | confidentiality matrix |

### 本人確認・共有

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-SHARE-001 | `30`,`31`,`42` snapshot | I7 | E2E-10 |
| FR-SHARE-002 | `42`,`44` view/download/print | I7 | browser/print |
| FR-SHARE-003 | `31`,`41`,`42` confirmation | I4/I7 | E2E-05/10 |
| FR-SHARE-004 | `30`,`33`,`42` Worker token | I7 | expiry/revoke |
| FR-SHARE-005 | `22`,`33`,`42` allowlist | I7 | leakage test |
| FR-SHARE-006 | `31`,`35` audit | I7/I9 | audit test |

### 制度参考情報

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-POLICY-001 | `31`,`43` version metadata | I8 | E2E-12 |
| FR-POLICY-002 | `03`,`31`,`43` separate type | I8 | E2E-12 |
| FR-POLICY-003 | `03`,`31`,`43` Management draft | I8 | draft exclusion |
| FR-POLICY-004 | `03`,`32` business days | I8 | holiday boundary |
| FR-POLICY-005 | `03`,`32` manual fact | I8 | 24h boundary |
| FR-POLICY-006 | `03`,`32`,`43` turnover | I8 | E2E-13 |
| FR-POLICY-007 | `03`,`41`,`43` disclaimer | I8 | UI assertion |

### レビュー・監査・運用

| ID | 設計 | Slice | Test |
|---|---|---|---|
| FR-REV-001 | `31`,`33`,`43` | I8 | E2E-09 |
| FR-REV-002 | `31`,`43` history | I8 | review lifecycle |
| FR-AUDIT-001 | `31`,`35` events | 全slice | audit matrix |
| FR-AUDIT-002 | `34`,`35`,`43` scope | I1/I9 | audit negative |
| FR-AUDIT-003 | `22`,`35` metadata only | 全slice | log leak scan |
| FR-OPS-001 | `31`,`36`,`43` retention | I9 | E2E-14 |
| FR-OPS-002 | `36` backup/export | I9 | E2E-15 |

## 3. 非機能要件

### Security・Privacy

| ID | 設計 | Test/証拠 |
|---|---|---|
| NFR-SEC-001 | `34`,`35` server policy | role/Unit/ACL matrix |
| NFR-SEC-002 | `33` scope query/404 | IDOR test |
| NFR-SEC-003 | `22`,`33`,`42` fixed approval hash | bypass test |
| NFR-SEC-004 | `35`,`36`,`44` redaction | secret/log/error scan |
| NFR-SEC-005 | `31`,`33` token hash | DB assertion |
| NFR-SEC-006 | `33`,`42` server expiry/revoke | share E2E |
| NFR-SEC-007 | `25`,`35` provider gate | PoC contract record |

### Availability・復旧

| ID | 設計 | Test/証拠 |
|---|---|---|
| NFR-AVL-001 | `36` daily backup | restore report/RPO |
| NFR-AVL-002 | `36` runbook | timed restore/RTO |
| NFR-AVL-003 | `20`,`42`,`46` manual | E2E-06 |
| NFR-AVL-004 | `36` Time Travel/R2 30d | retention + restore |

### Performance・規模

| ID | 設計 | Test/証拠 |
|---|---|---|
| NFR-PERF-001 | `30` 12-user serverless | synthetic load |
| NFR-PERF-002 | `36` normal API p95 1s target | preview metrics |
| NFR-PERF-003 | `30`,`42` AI state/manual | concurrent UX test |
| NFR-PERF-004 | `23`,`31` execution fingerprint | cache/idempotency |

### Cost

| ID | 設計 | Test/証拠 |
|---|---|---|
| NFR-COST-001 | `30`,`36` Workers/D1/R2 | monthly estimate |
| NFR-COST-002 | `31`,`43` ledger | operation/user/model report |
| NFR-COST-003 | `25`,`31` cap | 80/100 test |
| NFR-COST-004 | `25` low-cost PoC | model ADR |

### UX・Accessibility

| ID | 設計 | Test/証拠 |
|---|---|---|
| NFR-UX-001 | `21`,`41` 1〜3 questions | component/E2E |
| NFR-UX-002 | `40`〜`42` badges/sections | visual/a11y test |
| NFR-UX-003 | `41`,`42`,`46` manual | E2E-06 |
| NFR-UX-004 | `44`,`45` WCAG 2.2 AA | automated + manual |
| NFR-UX-005 | `42`,`44` share HTML | mobile/print test |

### Maintainability・監査

| ID | 設計 | Test/証拠 |
|---|---|---|
| NFR-MNT-001 | `23`,`31` versions | DB/contract test |
| NFR-MNT-002 | `31`,`35`,`43` history/audit | change trace |
| NFR-MNT-003 | `01`,`31`,`40` status | enum/UI test |
| NFR-MNT-004 | `03`,`36` 3 years | retention policy |

## 4. 禁止要件の検証

| 禁止 | 強制点 | Test |
|---|---|---|
| AI自動目標確定 | `20`,`23`,`31`,`42` | suggestion cannot transition |
| AI人事判断 | Prompt/schema/output validator | adversarial golden set |
| 未確認目標の正式扱い | goal transition + query filter | E2E-05 |
| Frontend-only認可 | API/repository policy | negative matrix |
| 未匿名化・未承認AI送信 | prepare/approve hash | bypass test |
| EXECの元データ上書き | capability/API | E2E-09 |
| 他Member/Unitの共有 | snapshot allowlist | E2E-10 |
| 旧技術構成の流用 | `30`,`37`,AGENTS | architecture review |

## 5. Traceability完了判定

すべてのPhase 1 ID付き要件と禁止要件が、少なくとも1つの設計、実装slice、検証へ対応している。未対応IDは0件。
