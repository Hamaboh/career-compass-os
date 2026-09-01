"use client";

import { FormEvent, useEffect, useState } from "react";

const csrf = () =>
  document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("cc_csrf="))
    ?.slice(8) ?? "";

type User = {
  id: string;
  email_normalized: string;
  display_name: string;
  status: string;
  last_login_at: string | null;
  version: number;
  roles_json: string;
  unit_ids_json: string;
};
type Unit = { id: string; code: string; name: string; status: string };
type AiPolicy = {
  id: string;
  operation: string;
  provider: string;
  model_alias: string;
  enabled: number;
  monthly_cap_microunits: number;
  version: number;
};
type Retention = {
  id: string;
  subject_type: string;
  subject_id: string;
  due_at: string;
  status: string;
  basis: string;
  preview_json: string;
  preview_hash: string;
  version: number;
};
type Backup = {
  id: string;
  environment: string;
  status: string;
  source_timestamp: string;
  expires_at: string;
  created_at: string;
};
type AuditEvent = {
  id: string;
  event_type: string;
  occurred_at: string;
  actor_id: string | null;
  target_type: string;
  target_id: string | null;
  outcome: string;
  request_id: string;
};
type Settings = {
  maintenance_mode: number;
  ai_incident_disabled: number;
  share_incident_disabled: number;
  mail_incident_disabled: number;
  incident_reason: string;
  version: number;
};
type Overview = {
  settings: Settings;
  aiPolicies: AiPolicy[];
  aiUsage: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  retention: Array<Record<string, unknown>>;
  backups: Backup[];
  restoreExercises: Array<Record<string, unknown>>;
  quota: Array<Record<string, unknown>>;
  thresholds: Record<string, number>;
  notice: string;
};

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [retention, setRetention] = useState<Retention[]>([]);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [message, setMessage] = useState("読み込み中です…");

  async function load() {
    try {
      const [
        overviewResponse,
        usersResponse,
        retentionResponse,
        auditResponse,
      ] = await Promise.all([
        fetch("/api/v1/admin/overview"),
        fetch("/api/v1/admin/users"),
        fetch("/api/v1/admin/retention"),
        fetch("/api/v1/audit-events?limit=25"),
      ]);
      if (
        !overviewResponse.ok ||
        !usersResponse.ok ||
        !retentionResponse.ok ||
        !auditResponse.ok
      )
        throw new Error("admin_not_visible");
      const overviewData = (await overviewResponse.json()) as {
        data: Overview;
      };
      const userData = (await usersResponse.json()) as {
        data: { users: User[]; units: Unit[] };
      };
      const retentionData = (await retentionResponse.json()) as {
        data: Retention[];
      };
      const auditData = (await auditResponse.json()) as {
        data: { events: AuditEvent[] };
      };
      setOverview(overviewData.data);
      setUsers(userData.data.users);
      setUnits(userData.data.units);
      setRetention(retentionData.data);
      setAudits(auditData.data.events);
      setMessage(overviewData.data.notice);
    } catch {
      setMessage(
        "管理情報を表示できません。SYSTEM_ADMIN権限を確認してください。",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function send(path: string, body: unknown, method = "POST") {
    setMessage("処理中です…");
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body),
    });
    if (response.status === 409) {
      setMessage(
        "競合または安全条件未達です。最新状態、別管理者承認、直近backupを確認してください。",
      );
      return;
    }
    if (!response.ok) {
      setMessage(
        "処理できませんでした。権限・入力・安全条件を確認してください。",
      );
      return;
    }
    await load();
    setMessage("処理を記録しました。監査イベントを確認できます。");
  }

  function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send("/api/v1/admin/users", {
      accessSubject: form.get("accessSubject"),
      email: form.get("email"),
      displayName: form.get("displayName"),
      status: "ACTIVE",
      roles: form.getAll("roles"),
      unitIds: form.getAll("unitIds"),
      reason: form.get("reason"),
    });
  }

  function updateUser(event: FormEvent<HTMLFormElement>, user: User) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send(
      `/api/v1/admin/users/${user.id}/access`,
      {
        version: user.version,
        status: form.get("status"),
        roles: form.getAll("roles"),
        unitIds: form.getAll("unitIds"),
        reason: form.get("reason"),
      },
      "PATCH",
    );
  }

  function updateAi(event: FormEvent<HTMLFormElement>, policy: AiPolicy) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send(
      `/api/v1/admin/ai-policies/${policy.id}`,
      {
        version: policy.version,
        enabled: form.get("enabled") === "on",
        monthlyCapMicrounits: Number(form.get("cap")),
        reason: form.get("reason"),
      },
      "PATCH",
    );
  }

  function updateSwitches(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overview) return;
    const form = new FormData(event.currentTarget);
    void send(
      "/api/v1/admin/incident-switches",
      {
        version: overview.settings.version,
        maintenanceMode: form.get("maintenance") === "on",
        aiDisabled: form.get("ai") === "on",
        shareDisabled: form.get("share") === "on",
        mailDisabled: form.get("mail") === "on",
        reason: form.get("reason"),
      },
      "PATCH",
    );
  }

  function scanRetention() {
    void send("/api/v1/admin/retention", {
      asOf: new Date().toISOString(),
      idempotencyKey: `manual-${new Date().toISOString().slice(0, 10)}`,
    });
  }

  function approveRetention(item: Retention) {
    void send(`/api/v1/admin/retention/${item.id}/approve`, {
      version: item.version,
      previewHash: item.preview_hash,
    });
  }

  function executeRetention(item: Retention) {
    void send(`/api/v1/admin/retention/${item.id}/execute`, {
      version: item.version,
      previewHash: item.preview_hash,
    });
  }

  function createBackup() {
    const now = new Date().toISOString();
    void send("/api/v1/admin/backups", {
      environment: "PREVIEW",
      sourceTimestamp: now,
      idempotencyKey: `manual-${now}`,
    });
  }

  function recordRestore(event: FormEvent<HTMLFormElement>, backup: Backup) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const toIso = (value: FormDataEntryValue | null) =>
      new Date(String(value)).toISOString();
    void send(`/api/v1/admin/backups/${backup.id}/restore-exercises`, {
      environment: "PREVIEW",
      startedAt: toIso(form.get("startedAt")),
      completedAt: toIso(form.get("completedAt")),
      authorizationSmokeVerified: form.get("auth") === "on",
      notes: form.get("notes"),
    });
  }

  function recordQuota(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send("/api/v1/admin/quotas", {
      environment: form.get("environment"),
      workersPercent: Number(form.get("workers")),
      d1Percent: Number(form.get("d1")),
      r2Percent: Number(form.get("r2")),
      source: form.get("source"),
    });
  }

  function searchAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ limit: "100" });
    for (const key of [
      "from",
      "to",
      "actorId",
      "unitId",
      "eventType",
      "subjectType",
      "outcome",
      "requestId",
    ]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    setMessage("監査ログを検索中です…");
    void fetch(`/api/v1/audit-events?${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("audit_search_failed");
        return (await response.json()) as { data: { events: AuditEvent[] } };
      })
      .then((data) => {
        setAudits(data.data.events);
        setMessage(
          `${data.data.events.length}件を表示しています。本文は含みません。`,
        );
      })
      .catch(() => setMessage("監査ログを検索できませんでした。"));
  }

  async function exportAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      from: new Date(String(form.get("from"))).toISOString(),
      to: new Date(String(form.get("to"))).toISOString(),
      limit: 1000,
    };
    const response = await fetch("/api/v1/audit-events/export", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setMessage("監査exportを作成できませんでした。");
      return;
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audit-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage("安全な監査exportを作成しました。本文・PIIは含みません。");
  }

  return (
    <main id="main-content">
      <section className="panel">
        <h1>システム管理・運用</h1>
        <p className="status" aria-live="polite">
          {message}
        </p>
        <p>
          管理画面にMember本文、Prompt、raw
          token、Secretは表示しません。匿名化と復旧は取消不能部分を含むため、確認と監査を必須にしています。
        </p>
      </section>

      {overview && (
        <>
          <section className="panel">
            <h2>Observability</h2>
            <p>
              本文を含まない運用metadataです。Quotaは80%で警告、backupは日次、復旧演習はRPO
              24時間・RTO 1営業日を目標にします。
            </p>
            <h3>Job queue</h3>
            <pre>{JSON.stringify(overview.jobs, null, 2)}</pre>
            <h3>AI月次cost</h3>
            <pre>{JSON.stringify(overview.aiUsage, null, 2)}</pre>
            <h3>Retention</h3>
            <pre>{JSON.stringify(overview.retention, null, 2)}</pre>
            <h3>Quota snapshot</h3>
            <pre>{JSON.stringify(overview.quota, null, 2)}</pre>
            <h3>Restore exercise</h3>
            <pre>{JSON.stringify(overview.restoreExercises, null, 2)}</pre>
          </section>

          <section className="panel">
            <h2>Incident switch</h2>
            <form onSubmit={updateSwitches}>
              <label>
                <input
                  name="maintenance"
                  type="checkbox"
                  defaultChecked={Boolean(overview.settings.maintenance_mode)}
                />{" "}
                Maintenance mode
              </label>
              <label>
                <input
                  name="ai"
                  type="checkbox"
                  defaultChecked={Boolean(
                    overview.settings.ai_incident_disabled,
                  )}
                />{" "}
                AIを停止
              </label>
              <label>
                <input
                  name="share"
                  type="checkbox"
                  defaultChecked={Boolean(
                    overview.settings.share_incident_disabled,
                  )}
                />{" "}
                共有を停止
              </label>
              <label>
                <input
                  name="mail"
                  type="checkbox"
                  defaultChecked={Boolean(
                    overview.settings.mail_incident_disabled,
                  )}
                />{" "}
                メールを停止
              </label>
              <label>
                変更理由
                <input name="reason" required maxLength={1000} />
              </label>
              <button type="submit">停止状態を更新</button>
            </form>
          </section>

          <section className="panel">
            <h2>AI設定・費用</h2>
            <p>
              月額上限の80%で警告、100%で新規AI実行を停止します。高価格モデルへの自動切替はありません。
            </p>
            {overview.aiPolicies.map((policy) => (
              <form
                key={policy.id}
                onSubmit={(event) => updateAi(event, policy)}
              >
                <strong>{policy.operation}</strong> — {policy.provider}/
                {policy.model_alias}
                <label>
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={Boolean(policy.enabled)}
                  />{" "}
                  有効
                </label>
                <label>
                  月間上限（microunits）
                  <input
                    name="cap"
                    type="number"
                    min="1"
                    max="1000000000"
                    defaultValue={policy.monthly_cap_microunits}
                    required
                  />
                </label>
                <label>
                  変更理由
                  <input name="reason" required maxLength={1000} />
                </label>
                <button type="submit">AI設定を更新</button>
              </form>
            ))}
          </section>
        </>
      )}

      <section className="panel">
        <h2>利用者・Role・Unit scope</h2>
        <form onSubmit={createUser}>
          <h3>利用者登録</h3>
          <label>
            Access subject
            <input name="accessSubject" required />
          </label>
          <label>
            Workspace email
            <input name="email" type="email" required />
          </label>
          <label>
            表示名
            <input name="displayName" required />
          </label>
          <fieldset>
            <legend>Role</legend>
            {["SYSTEM_ADMIN", "EXECUTIVE", "UL"].map((role) => (
              <label key={role}>
                <input name="roles" type="checkbox" value={role} /> {role}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Unit scope</legend>
            {units
              .filter((unit) => unit.status === "ACTIVE")
              .map((unit) => (
                <label key={unit.id}>
                  <input name="unitIds" type="checkbox" value={unit.id} />{" "}
                  {unit.code}: {unit.name}
                </label>
              ))}
          </fieldset>
          <label>
            登録理由
            <input name="reason" required maxLength={1000} />
          </label>
          <button type="submit">利用者を登録</button>
        </form>
        {users.map((user) => {
          const currentRoles = JSON.parse(user.roles_json) as string[];
          const currentUnits = JSON.parse(user.unit_ids_json) as string[];
          return (
            <form key={user.id} onSubmit={(event) => updateUser(event, user)}>
              <h3>{user.display_name}</h3>
              <p>
                {user.email_normalized} / 最終ログイン:{" "}
                {user.last_login_at ?? "未記録"}
              </p>
              <label>
                状態
                <select name="status" defaultValue={user.status}>
                  <option>ACTIVE</option>
                  <option>SUSPENDED</option>
                  <option>REVOKED</option>
                </select>
              </label>
              <fieldset>
                <legend>Role</legend>
                {["SYSTEM_ADMIN", "EXECUTIVE", "UL"].map((role) => (
                  <label key={role}>
                    <input
                      name="roles"
                      type="checkbox"
                      value={role}
                      defaultChecked={currentRoles.includes(role)}
                    />{" "}
                    {role}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Unit scope</legend>
                {units
                  .filter((unit) => unit.status === "ACTIVE")
                  .map((unit) => (
                    <label key={unit.id}>
                      <input
                        name="unitIds"
                        type="checkbox"
                        value={unit.id}
                        defaultChecked={currentUnits.includes(unit.id)}
                      />{" "}
                      {unit.code}: {unit.name}
                    </label>
                  ))}
              </fieldset>
              <label>
                変更理由
                <input name="reason" required maxLength={1000} />
              </label>
              <button type="submit">権限差分を確認して更新</button>
            </form>
          );
        })}
      </section>

      <section className="panel">
        <h2>保持・匿名化</h2>
        <p>
          退職・管理対象外から1年経過した個人データと、3年を超えた監査eventを候補化します。実行には別のSYSTEM_ADMINによる承認と24時間以内のbackupが必要です。
        </p>
        <button type="button" onClick={scanRetention}>
          匿名化候補を更新
        </button>
        {retention.map((item) => (
          <article key={item.id}>
            <h3>
              {item.subject_type} — {item.status}
            </h3>
            <p>
              基準: {item.basis} / 期限: {item.due_at}
            </p>
            <pre>{JSON.stringify(JSON.parse(item.preview_json), null, 2)}</pre>
            {item.status === "CANDIDATE" && (
              <button type="button" onClick={() => approveRetention(item)}>
                保持処理内容を承認
              </button>
            )}
            {item.status === "APPROVED" && (
              <button type="button" onClick={() => executeRetention(item)}>
                別管理者として保持処理を実行
              </button>
            )}
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>Backup・restore演習</h2>
        <p>
          Private R2のmanifestは30日保持し、RPO 24時間・RTO
          1営業日を検証します。本番restoreはこの画面から実行しません。
        </p>
        <button type="button" onClick={createBackup}>
          Preview backup manifestを作成
        </button>
        {overview?.backups.map((backup) => (
          <form
            key={backup.id}
            onSubmit={(event) => recordRestore(event, backup)}
          >
            <strong>{backup.status}</strong> — {backup.source_timestamp} / 期限{" "}
            {backup.expires_at}
            <label>
              演習開始
              <input name="startedAt" type="datetime-local" required />
            </label>
            <label>
              演習完了
              <input name="completedAt" type="datetime-local" required />
            </label>
            <label>
              <input name="auth" type="checkbox" required />{" "}
              復旧先で認可smokeを確認済み
            </label>
            <label>
              記録
              <input name="notes" maxLength={1000} />
            </label>
            <button type="submit" disabled={backup.status !== "READY"}>
              復旧検証結果を記録
            </button>
          </form>
        ))}
      </section>

      <section className="panel">
        <h2>Quota</h2>
        <form onSubmit={recordQuota}>
          <label>
            環境
            <select name="environment">
              <option>PREVIEW</option>
              <option>LOCAL</option>
              <option>PRODUCTION</option>
            </select>
          </label>
          <label>
            Workers %
            <input name="workers" type="number" min="0" max="100" required />
          </label>
          <label>
            D1 %<input name="d1" type="number" min="0" max="100" required />
          </label>
          <label>
            R2 %<input name="r2" type="number" min="0" max="100" required />
          </label>
          <label>
            根拠
            <select name="source">
              <option>SYNTHETIC</option>
              <option>MANUAL_CLOUDFLARE</option>
            </select>
          </label>
          <button type="submit">Quota snapshotを記録</button>
        </form>
      </section>

      <section className="panel">
        <h2>監査検索</h2>
        <form onSubmit={searchAudit}>
          <label>
            開始（UTC ISO 8601）
            <input name="from" />
          </label>
          <label>
            終了（UTC ISO 8601）
            <input name="to" />
          </label>
          <label>
            Actor ID
            <input name="actorId" />
          </label>
          <label>
            Unit ID
            <input name="unitId" />
          </label>
          <label>
            Event type
            <input name="eventType" />
          </label>
          <label>
            Subject type
            <input name="subjectType" />
          </label>
          <label>
            Outcome
            <select name="outcome">
              <option value="">すべて</option>
              <option>ALLOWED</option>
              <option>DENIED</option>
              <option>SUCCEEDED</option>
            </select>
          </label>
          <label>
            Request ID
            <input name="requestId" />
          </label>
          <button type="submit">監査metadataを検索</button>
        </form>
        <form onSubmit={exportAudit}>
          <h3>安全な監査export</h3>
          <p>
            31日以内・最大1,000件。本文、識別子、metadata、Prompt、token、Secretは除外します。
          </p>
          <label>
            開始
            <input name="from" type="datetime-local" required />
          </label>
          <label>
            終了
            <input name="to" type="datetime-local" required />
          </label>
          <button type="submit">監査metadataをexport</button>
        </form>
        {audits.length === 0 ? (
          <p>条件に一致する監査イベントはありません。</p>
        ) : (
          <table>
            <caption>本文を含まない監査イベント</caption>
            <thead>
              <tr>
                <th>日時</th>
                <th>Event</th>
                <th>対象</th>
                <th>結果</th>
                <th>Request ID</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((event) => (
                <tr key={event.id}>
                  <td>{event.occurred_at}</td>
                  <td>{event.event_type}</td>
                  <td>{event.target_type}</td>
                  <td>{event.outcome}</td>
                  <td>{event.request_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
