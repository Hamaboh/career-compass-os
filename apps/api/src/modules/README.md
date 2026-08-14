# モジュール配置予定（Step 0以降）

Phase3の設計に対応させ、以下の単位でNestJSモジュールを追加していく。まだ空。

| ディレクトリ（予定） | 対応するPhase3の章 | 着手Step |
|---|---|---|
| `auth/` | 7章RBAC、8〜12章 認証フロー | Step 0 |
| `common/guards/` | 7.4節 AuthGuard/PermissionGuard/ScopeGuard | Step 0 |
| `employees/`, `units/` | 5.A節 | Step 0（一部）／Step 7 |
| `goals/`（visions/directions/long-term-goals/checkpoints/actions/evidences/reflections） | 5.D節 | Step 1 |
| `smart/` | 5.E節 | Step 2 |
| `self-understanding/`（self-analysis/dream/why） | 5.C節 | Step 3 |
| `progress/`, `reminders/` | 5.G節 | Step 4 |
| `institutional/`（kpi-master/ulm-master/evaluation-periods） | 5.B節 | Step 8 |
| `one-on-one/` | 5.H節 | Step 6 |
| `notifications/` | 5.I節 | Step 4 |
| `ai-orchestration/` | 14章（唯一のAI呼び出し経路） | Step 3以降、必要な都度 |
| `audit/` | 15章 | Step 9 |

新規モジュールを追加する際は、対応するPhase3のテーブル定義・APIリソース（13.2節）と一致させること。
