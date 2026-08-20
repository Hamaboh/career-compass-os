# Phase 3: 技術決定・トレーサビリティ・完了判定

## 1. 技術決定

| ID | 状態 | 決定 | 主な根拠 |
|---|---|---|---|
| P3-ARCH-001 | CONFIRMED | Next.js full-stackをCloudflare Workersへ単一deploy | 小規模、低運用、OpenNext対応 |
| P3-ARCH-002 | CONFIRMED | NestJS、PostgreSQL、Redis、BullMQ、VercelをMVPで不採用 | 旧前提失効、過剰構成回避 |
| P3-DATA-001 | CONFIRMED | D1 + Drizzle + SQL migration | 型安全、Workers統合、明示migration |
| P3-DATA-002 | CONFIRMED | private R2をsnapshot/添付/backupに使用 | object非公開、Worker認可 |
| P3-AUTH-001 | CONFIRMED | Cloudflare Access + Google Workspace、app側RBAC | 認証と認可を分離 |
| P3-AUTH-002 | CONFIRMED | app password/OTP/session DBを持たない | Member非ログイン、Access token利用 |
| P3-AUTHZ-001 | CONFIRMED | SYSTEM_ADMIN/EXECUTIVE/UL + capability + Unit + ACL | roleだけでは機密境界が不足 |
| P3-AI-001 | POC_REQUIRED | AI Gateway + Workers AIを初期候補 | model/providerはPoCで確定 |
| P3-JOB-001 | CONFIRMED | Cron + D1 job/outboxを初期採用 | 低頻度・低コスト |
| P3-JOB-002 | PROVISIONAL | Queuesは再試行/量が必要時のみ導入 | at-least-onceと追加複雑性 |
| P3-MAIL-001 | CONFIRMED | Gmail API adapterを初期経路 | HTTP実行、Google Workspace、SMTP port 25不可 |
| P3-MAIL-002 | POC_REQUIRED | 既存SMTP adapterは465/587で互換PoC後のみ | 会社希望を残しruntime制約を検証 |
| P3-SHARE-001 | CONFIRMED | Worker検証token + private R2でHTML共有 | 7〜30日、即時失効、監査 |
| P3-OPS-001 | CONFIRMED | D1 Time Travel + 必要時日次R2 export | RPO24h、30日保持 |
| P3-OPS-002 | PROVISIONAL | Cloudflare planは実装前見積りで決定 | Time Travel/WAF/quotaと費用次第 |

## 2. 要件対応

| 要件群 | Phase 3設計 |
|---|---|
| FR-AUTH | `34-auth-rbac-access-control.md`、Access JWT + app user + RBAC |
| FR-MEM | `31-data-model-er.md`のMember/Unit履歴、`33-api-contracts.md` |
| FR-SELF | self analysis、future vision、provenance/confidentiality |
| FR-GOAL | goal/version/Why/SMART/action/evidence/confirmation |
| FR-AI | request/suggestion/prompt/model/budget、prepare-preview-approve API |
| FR-1ON1 | 1on1/entry/ACL、通常・機密・AI不可 |
| FR-SHARE | private R2 snapshot、hash token、7〜30日、server失効 |
| FR-POLICY | document/version/item、独立type、draft、period snapshot |
| FR-REV | review request/comment、Executiveは原本非編集 |
| FR-AUDIT | append-only metadata event、3年、scope filtering |
| FR-OPS | retention action、D1 Time Travel、日次export、restore runbook |
| NFR security | JWT、CSRF、XSS、SQLi、IDOR、rate limit、Secret、threat model |
| NFR cost | serverless単一構成、AI cap、quota alert、Queues条件付き |

## 3. 設計整合性レビュー

### 解消した矛盾

- 旧「Next.js + NestJS + PostgreSQL + Redis + BullMQ」と新しい低コストLeader-only MVPの矛盾は、Workers単一構成へ統一した。
- 旧招待/OTP/アプリパスワードとGoogle Workspace認証の矛盾は、Cloudflare Accessへ統一した。
- R2 presigned URLの最長7日と共有最大30日の差は、Worker検証share token方式で解消した。
- D1にRLSがない点は、central policy、scope付きquery、API deny testで補う。ただしこれはPostgreSQL RLSと同等機能ではなく、実装品質が重要な残余リスクである。
- SMTP port 25不可と会社SMTP希望は、Gmail APIを基本、465/587 SMTPをPoC待ちadapterとして分離した。

### 過剰設計を避けた点

- microservice、常駐backend、Redis、queueを初期必須にしない。
- Member account、電子署名、AI会議参加、メール/Slack監視を作らない。
- AI論理モジュールを個別常駐agentにしない。
- 正式人事評価・給与計算systemにしない。

## 4. 残余リスク

| Risk | 対応 |
|---|---|
| D1 application認可の実装漏れ | repositoryにPrincipal必須、API negative matrix、code review |
| OpenNextとNext.js version互換 | 実装開始時にsupport matrix、preview runtime test、version固定 |
| Gmail APIの管理者設定 | 手動setup、最小scope、専用アカウント、事前疎通 |
| 30日backupとfree plan差 | Paidか日次R2 exportを実装前に費用比較 |
| 匿名化の再識別 | UL preview、検出、意味保持不能時は送信禁止 |
| AI model未確定 | Phase 2 PoCをimplementation gateにする |
| 日本祝日データ | versioned sourceと境界値testをPhase 4で確定 |

## 5. 手動セットアップ一覧

- Cloudflare account、domain/DNS、production/preview subdomain
- Zero Trust、Google Workspace IdP、Access applications/AUD/policies
- 初期利用者、role、Unit scope、Member・制度data
- Gmail API project、専用送信account、OAuth/service account、送信domain設定
- Workers/D1/R2/AI Gateway/Secrets/Build integration
- backup/alert/incident連絡先

設計段階では作成せず、実装・導入フェーズのchecklistとして扱う。

## 6. Phase 3完了条件

- 技術stackと不採用構成が明確である。
- Phase 1のMUST要件をDB、API、認証認可、運用へ対応づけた。
- AI提案と確定データ、通常と機密、Unit範囲を保存・認可できる。
- 共有、監査、保持、backup、AI費用停止を実装可能な契約にした。
- 外部依存と手動設定、PoC待ちを事実上の確定事項と混同していない。
- application code、migration、package、cloud resourceはまだ作成していない。

Phase 4では本設計を変えず、情報設計、画面、操作、error/empty state、accessibility、test matrix、E2E、開発順序、Definition of Doneへ落とし込む。
