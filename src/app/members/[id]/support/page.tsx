"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const csrf = () =>
  document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("cc_csrf="))
    ?.slice(8) ?? "";

type Goal = {
  id: string;
  version: number;
  current_version_id: string;
  title: string;
  lifecycle_status: string;
  progress: Array<{
    id: string;
    state: string;
    percent: number | null;
    note: string;
    recorded_at: string;
  }>;
  reflections: Array<{
    id: string;
    learning: string;
    next_choice: string;
    period_end: string;
  }>;
  indicators: Array<{
    id: string;
    metric_type: string;
    value: number;
    source_type: string;
  }>;
  suggestions: Array<{
    id: string;
    suggestion_type: string;
    content: string;
    proposal_status: string;
    decision_status: string;
  }>;
  actions: Array<{
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    version: number;
  }>;
};
type Meeting = {
  id: string;
  version: number;
  scheduled_at: string;
  status: string;
  theme: string;
  next_at: string | null;
  entries: Array<{
    id: string;
    entry_type: string;
    body: string;
    provenance_type: string;
    confidentiality: string;
  }>;
};
type Reminder = {
  id: string;
  version: number;
  reminder_type: string;
  next_run_at: string;
  enabled: number;
  cadence_days: number | null;
  grace_minutes: number;
  stop_on_completion: number;
};
type SupportData = {
  canEdit: boolean;
  goals: Goal[];
  oneOnOnes: Meeting[];
  reminders: Reminder[];
};

export default function ContinuousSupportPage() {
  const memberId = String(useParams().id);
  const endpoint = `/api/v1/members/${memberId}/support`;
  const [data, setData] = useState<SupportData | null>(null);
  const [message, setMessage] = useState("読み込み中です…");

  useEffect(() => {
    void fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setData(((await response.json()) as { data: SupportData }).data);
        setMessage("");
      })
      .catch(() => setMessage("継続支援情報を表示できません。"));
  }, [endpoint]);

  async function send(path: string, body: unknown, method = "POST") {
    setMessage("保存中です…");
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body),
    });
    if (response.status === 409) {
      setMessage(
        "他の更新または現行revisionの変更がありました。再読み込みして差分を確認してください。",
      );
      return;
    }
    if (!response.ok) {
      setMessage(
        "保存できませんでした。入力、権限、機密区分を確認してください。",
      );
      return;
    }
    setData(((await response.json()) as { data: SupportData }).data);
    setMessage("保存しました。");
  }

  function progress(event: FormEvent<HTMLFormElement>, goal: Goal) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const confidential = form.get("confidentiality") === "CONFIDENTIAL";
    void send(`/api/v1/members/${memberId}/goals/${goal.id}/progress`, {
      version: goal.version,
      state: form.get("state"),
      percent: form.get("percent") === "" ? null : Number(form.get("percent")),
      selfRating:
        form.get("selfRating") === "" ? null : Number(form.get("selfRating")),
      note: form.get("note"),
      blocker: form.get("blocker"),
      nextCheckAt: form.get("nextCheckAt")
        ? `${form.get("nextCheckAt")}T00:00:00.000Z`
        : null,
      provenanceType: form.get("provenanceType"),
      confidentiality: confidential ? "CONFIDENTIAL" : "NORMAL",
      aiSendPolicy: confidential ? "AI_SEND_PROHIBITED" : "AI_SEND_ALLOWED",
    });
  }

  function reflection(event: FormEvent<HTMLFormElement>, goal: Goal) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const confidential = form.get("confidentiality") === "CONFIDENTIAL";
    void send(`/api/v1/members/${memberId}/goals/${goal.id}/reflections`, {
      version: goal.version,
      periodStart: form.get("periodStart"),
      periodEnd: form.get("periodEnd"),
      outcome: form.get("outcome"),
      learning: form.get("learning"),
      feeling: form.get("feeling"),
      nextChoice: form.get("nextChoice"),
      provenanceType: form.get("provenanceType"),
      confidentiality: confidential ? "CONFIDENTIAL" : "NORMAL",
      aiSendPolicy: confidential ? "AI_SEND_PROHIBITED" : "AI_SEND_ALLOWED",
    });
  }

  function indicator(event: FormEvent<HTMLFormElement>, goal: Goal) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const metricType = String(form.get("metricType"));
    void send(`/api/v1/members/${memberId}/goals/${goal.id}/indicators`, {
      version: goal.version,
      metricType,
      value: Number(form.get("value")),
      sourceType:
        metricType === "SMART_QUALITY"
          ? form.get("smartSource")
          : "MEMBER_SELF_REPORT",
      basisNote: form.get("basisNote"),
    });
  }

  function meeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send(`/api/v1/members/${memberId}/one-on-ones`, {
      scheduledAt: `${form.get("scheduledAt")}:00.000Z`,
      theme: form.get("theme"),
      nextAt: null,
    });
  }

  function entry(event: FormEvent<HTMLFormElement>, current: Meeting) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const confirmed = form.get("confirmedWithMember") === "yes";
    const confidential = form.get("confidentiality") === "CONFIDENTIAL";
    void send(`/api/v1/members/${memberId}/one-on-ones/${current.id}/entries`, {
      version: current.version,
      goalVersionId: form.get("goalVersionId") || null,
      entryType: form.get("entryType"),
      body: form.get("body"),
      provenanceType: confirmed
        ? "MEMBER_CONFIRMED"
        : form.get("provenanceType"),
      confidentiality: confidential ? "CONFIDENTIAL" : "NORMAL",
      aiSendPolicy: confidential ? "AI_SEND_PROHIBITED" : "AI_SEND_ALLOWED",
      confirmedWithMember: confirmed,
      confirmationMethod: confirmed ? form.get("confirmationMethod") : null,
      confirmedAt: confirmed ? `${form.get("confirmedAt")}:00.000Z` : null,
      memberConfirmationWords: confirmed
        ? form.get("memberConfirmationWords")
        : null,
    });
  }

  function updateMeeting(event: FormEvent<HTMLFormElement>, current: Meeting) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status"));
    void send(
      `/api/v1/members/${memberId}/one-on-ones/${current.id}`,
      {
        version: current.version,
        status,
        heldAt: status === "HELD" ? new Date().toISOString() : null,
        nextAt: form.get("nextAt") ? `${form.get("nextAt")}:00.000Z` : null,
        theme: form.get("theme"),
      },
      "PATCH",
    );
  }

  function reminder(
    event: FormEvent<HTMLFormElement>,
    subjectType: "GOAL" | "ACTION" | "ONE_ON_ONE",
    subjectId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send(`/api/v1/members/${memberId}/reminder-rules`, {
      subjectType,
      subjectId,
      reminderType: form.get("reminderType"),
      cadenceDays:
        form.get("cadenceDays") === "" ? null : Number(form.get("cadenceDays")),
      nextRunAt: `${form.get("nextRunAt")}:00.000Z`,
      graceMinutes: Number(form.get("graceMinutes")),
      stopOnCompletion: true,
    });
  }

  function updateReminder(
    event: FormEvent<HTMLFormElement>,
    current: Reminder,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send(
      `/api/v1/members/${memberId}/reminder-rules/${current.id}`,
      {
        version: current.version,
        nextRunAt: `${form.get("nextRunAt")}:00.000Z`,
        cadenceDays:
          form.get("cadenceDays") === ""
            ? null
            : Number(form.get("cadenceDays")),
        graceMinutes: Number(form.get("graceMinutes")),
        enabled: form.get("enabled") === "yes",
        stopOnCompletion: form.get("stopOnCompletion") === "yes",
      },
      "PATCH",
    );
  }

  return (
    <main id="main-content">
      <section className="panel">
        <p>
          <a href={`/members/${memberId}`}>Member詳細へ戻る</a> /{" "}
          <a href="/notifications">通知一覧</a>
        </p>
        <h1>継続支援</h1>
        <p>
          入力がないことを問題や低意欲とは判断しません。指標は参考情報であり、人事評価を決定しません。
        </p>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {!data?.goals.length && (
          <p>
            現在の目標はありません。探索、現状維持、後日確認のいずれも選べます。
          </p>
        )}
        {data?.goals.map((goal) => (
          <article className="panel" key={goal.id}>
            <h2>{goal.title}</h2>
            <p>
              <span className="status">{goal.lifecycle_status}</span> /
              現行revision: {goal.current_version_id}
            </p>
            <h3>履歴</h3>
            <ul>
              {goal.progress.map((item) => (
                <li key={item.id}>
                  {item.recorded_at}: {item.state} /{" "}
                  {item.percent ?? "定量値なし"}% —{" "}
                  {item.note || "事実メモなし"}
                </li>
              ))}
            </ul>
            <ul>
              {goal.reflections.map((item) => (
                <li key={item.id}>
                  {item.period_end}: {item.learning || "学びは未記入"} /
                  次の選択: {item.next_choice}
                </li>
              ))}
            </ul>
            <ul>
              {goal.indicators.map((item) => (
                <li key={item.id}>
                  {item.metric_type}: {item.value}/100（{item.source_type}
                  ・参考指標）
                </li>
              ))}
            </ul>
            <h3>AI候補（未確定）</h3>
            <ul>
              {goal.suggestions.map((item) => (
                <li key={item.id}>
                  <strong>{item.proposal_status}</strong>: {item.content}（
                  {item.decision_status}）
                </li>
              ))}
            </ul>
            {data.canEdit && (
              <button
                onClick={() =>
                  void send(
                    `/api/v1/members/${memberId}/goals/${goal.id}/support-suggestions`,
                    { version: goal.version },
                  )
                }
              >
                deterministic候補を作成
              </button>
            )}
            {data.canEdit && (
              <details>
                <summary>進捗を記録</summary>
                <form
                  className="form"
                  onSubmit={(event) => progress(event, goal)}
                >
                  <label>
                    状態
                    <select name="state">
                      <option value="NOT_STARTED">未着手</option>
                      <option value="IN_PROGRESS">進行中</option>
                      <option value="PAUSED">保留</option>
                      <option value="COMPLETED">完了</option>
                      <option value="CANCELLED">中止</option>
                    </select>
                  </label>
                  <label>
                    現在進捗（任意・0〜100）
                    <input name="percent" type="number" min="0" max="100" />
                  </label>
                  <label>
                    本人自己評価（任意・0〜100）
                    <input name="selfRating" type="number" min="0" max="100" />
                  </label>
                  <label>
                    確認できた事実
                    <textarea name="note" />
                  </label>
                  <label>
                    障害・支援要否
                    <textarea name="blocker" />
                  </label>
                  <label>
                    次の確認日
                    <input name="nextCheckAt" type="date" />
                  </label>
                  <label>
                    出所
                    <select name="provenanceType">
                      <option value="MEMBER_STATEMENT">本人発言</option>
                      <option value="UL_OBSERVATION">UL所見</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="confidentiality"
                      value="CONFIDENTIAL"
                    />{" "}
                    機密・AI送信不可
                  </label>
                  <button>進捗を保存</button>
                </form>
              </details>
            )}
            {data.canEdit && (
              <details>
                <summary>振り返りを記録</summary>
                <form
                  className="form"
                  onSubmit={(event) => reflection(event, goal)}
                >
                  <label>
                    期間開始
                    <input name="periodStart" type="date" required />
                  </label>
                  <label>
                    期間終了
                    <input name="periodEnd" type="date" required />
                  </label>
                  <label>
                    成果
                    <textarea name="outcome" />
                  </label>
                  <label>
                    学び
                    <textarea name="learning" />
                  </label>
                  <label>
                    本人の感情
                    <textarea name="feeling" />
                  </label>
                  <label>
                    次の選択
                    <select name="nextChoice">
                      <option value="CONTINUE">継続</option>
                      <option value="REST">休止</option>
                      <option value="EXPLORE">探索</option>
                      <option value="NEXT_MILESTONE">次の通過点</option>
                      <option value="REVISE">修正を検討</option>
                      <option value="HOLD">保留</option>
                    </select>
                  </label>
                  <label>
                    出所
                    <select name="provenanceType">
                      <option value="MEMBER_STATEMENT">本人発言</option>
                      <option value="UL_OBSERVATION">UL所見</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="confidentiality"
                      value="CONFIDENTIAL"
                    />{" "}
                    機密・AI送信不可
                  </label>
                  <button>振り返りを保存</button>
                </form>
              </details>
            )}
            {data.canEdit && (
              <details>
                <summary>参考指標を記録</summary>
                <form
                  className="form"
                  onSubmit={(event) => indicator(event, goal)}
                >
                  <label>
                    指標
                    <select name="metricType">
                      <option value="WHY_SATISFACTION">Why納得度</option>
                      <option value="GOAL_SATISFACTION">目標納得度</option>
                      <option value="DREAM_CONFIDENCE">夢への確信度</option>
                      <option value="SMART_QUALITY">SMART品質</option>
                      <option value="ACHIEVABILITY">達成可能性</option>
                      <option value="CURRENT_PROGRESS">現在進捗</option>
                      <option value="MEMBER_SELF_RATING">本人自己評価</option>
                    </select>
                  </label>
                  <label>
                    値（参考・0〜100）
                    <input
                      name="value"
                      type="number"
                      min="0"
                      max="100"
                      required
                    />
                  </label>
                  <label>
                    SMART品質の出所
                    <select name="smartSource">
                      <option value="UL_REFERENCE">UL参考</option>
                      <option value="AI_REFERENCE">AI参考</option>
                      <option value="MEMBER_SELF_REPORT">本人自己申告</option>
                    </select>
                  </label>
                  <label>
                    根拠メモ
                    <textarea name="basisNote" />
                  </label>
                  <button>参考指標を保存</button>
                </form>
              </details>
            )}
            {data.canEdit && (
              <details>
                <summary>リマインダーを設定</summary>
                <form
                  className="form"
                  onSubmit={(event) => reminder(event, "GOAL", goal.id)}
                >
                  <label>
                    種類
                    <select name="reminderType">
                      <option value="MIDPOINT_CHECK">中間確認</option>
                      <option value="REFLECTION">振り返り</option>
                      <option value="SMART_RECHECK">SMART再確認</option>
                      <option value="GOAL_DUE">目標期限</option>
                      <option value="GOAL_UPDATE">更新</option>
                      <option value="UNANSWERED">未回答</option>
                    </select>
                  </label>
                  <label>
                    次回日時（UTC）
                    <input name="nextRunAt" type="datetime-local" required />
                  </label>
                  <label>
                    周期（日・任意）
                    <input name="cadenceDays" type="number" min="1" max="365" />
                  </label>
                  <label>
                    猶予（分）
                    <input
                      name="graceMinutes"
                      type="number"
                      min="0"
                      max="43200"
                      defaultValue="0"
                    />
                  </label>
                  <button>通知周期を保存</button>
                </form>
              </details>
            )}
            {data.canEdit && !!goal.actions.length && (
              <details>
                <summary>行動期限のリマインダー</summary>
                {goal.actions.map((action) => (
                  <form
                    className="form"
                    key={action.id}
                    onSubmit={(event) => reminder(event, "ACTION", action.id)}
                  >
                    <p>
                      {action.title}（{action.status} / 期限
                      {action.due_date ?? "未設定"}）
                    </p>
                    <input
                      type="hidden"
                      name="reminderType"
                      value="ACTION_DUE"
                    />
                    <label>
                      次回日時（UTC）
                      <input name="nextRunAt" type="datetime-local" required />
                    </label>
                    <label>
                      周期（日・任意）
                      <input
                        name="cadenceDays"
                        type="number"
                        min="1"
                        max="365"
                      />
                    </label>
                    <label>
                      猶予（分）
                      <input
                        name="graceMinutes"
                        type="number"
                        min="0"
                        max="43200"
                        defaultValue="0"
                      />
                    </label>
                    <button>行動通知を保存</button>
                  </form>
                ))}
              </details>
            )}
          </article>
        ))}
        <h2>1on1</h2>
        {!data?.oneOnOnes.length && (
          <p>1on1記録はありません。未記録を問題とは扱いません。</p>
        )}
        {data?.oneOnOnes.map((current) => (
          <article className="panel" key={current.id}>
            <h3>
              {current.scheduled_at} / {current.status}
            </h3>
            <p>{current.theme || "テーマ未設定"}</p>
            <ul>
              {current.entries.map((item) => (
                <li key={item.id}>
                  {item.entry_type} / {item.provenance_type} /{" "}
                  {item.confidentiality}: {item.body}
                </li>
              ))}
            </ul>
            {data.canEdit && (
              <form
                className="form"
                onSubmit={(event) => updateMeeting(event, current)}
              >
                <label>
                  状態
                  <select name="status" defaultValue={current.status}>
                    <option value="SCHEDULED">予定</option>
                    <option value="HELD">実施済み</option>
                    <option value="NEEDS_FOLLOW_UP">追加確認あり</option>
                    <option value="CANCELLED">中止</option>
                  </select>
                </label>
                <label>
                  テーマ
                  <textarea name="theme" defaultValue={current.theme} />
                </label>
                <label>
                  次回確認（UTC）
                  <input name="nextAt" type="datetime-local" />
                </label>
                <button>1on1状態を更新</button>
              </form>
            )}
            {data.canEdit && (
              <form
                className="form"
                onSubmit={(event) => entry(event, current)}
              >
                <label>
                  区分
                  <select name="entryType">
                    <option value="MEMBER_STATEMENT">本人発言</option>
                    <option value="UL_OBSERVATION">UL所見</option>
                    <option value="AGREEMENT">合意</option>
                    <option value="UNCONFIRMED">未確認</option>
                    <option value="NEXT_ACTION">次の行動</option>
                    <option value="UL_SUPPORT">UL支援</option>
                    <option value="RAW_NOTE">原メモ</option>
                  </select>
                </label>
                <label>
                  内容
                  <textarea name="body" required />
                </label>
                <label>
                  出所
                  <select name="provenanceType">
                    <option value="MEMBER_STATEMENT">本人発言</option>
                    <option value="UL_OBSERVATION">UL所見</option>
                  </select>
                </label>
                <label>
                  関連する現行目標revision（任意）
                  <select name="goalVersionId">
                    <option value="">なし</option>
                    {data.goals.map((goal) => (
                      <option
                        key={goal.current_version_id}
                        value={goal.current_version_id}
                      >
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="confirmedWithMember"
                    value="yes"
                  />{" "}
                  本人と合意済み
                </label>
                <label>
                  本人確認方法（合意済みの場合）
                  <select name="confirmationMethod">
                    <option value="IN_PERSON">対面</option>
                    <option value="VIDEO">ビデオ通話</option>
                    <option value="PHONE">電話</option>
                    <option value="OTHER">その他</option>
                  </select>
                </label>
                <label>
                  本人確認日時（UTC・合意済みの場合）
                  <input name="confirmedAt" type="datetime-local" />
                </label>
                <label>
                  本人の確認時の言葉（合意済みの場合）
                  <textarea name="memberConfirmationWords" />
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="confidentiality"
                    value="CONFIDENTIAL"
                  />{" "}
                  機密・AI送信不可
                </label>
                <button>1on1記録を追加</button>
              </form>
            )}
            {data.canEdit && (
              <details>
                <summary>1on1リマインダーを設定</summary>
                <form
                  className="form"
                  onSubmit={(event) =>
                    reminder(event, "ONE_ON_ONE", current.id)
                  }
                >
                  <label>
                    種類
                    <select name="reminderType">
                      <option value="ONE_ON_ONE">1on1予定</option>
                      <option value="UNANSWERED">未回答の確認</option>
                    </select>
                  </label>
                  <label>
                    次回日時（UTC）
                    <input name="nextRunAt" type="datetime-local" required />
                  </label>
                  <label>
                    周期（日・任意）
                    <input name="cadenceDays" type="number" min="1" max="365" />
                  </label>
                  <label>
                    猶予（分）
                    <input
                      name="graceMinutes"
                      type="number"
                      min="0"
                      max="43200"
                      defaultValue="0"
                    />
                  </label>
                  <button>1on1通知を保存</button>
                </form>
              </details>
            )}
          </article>
        ))}
        {data?.canEdit && (
          <form className="form" onSubmit={meeting}>
            <h3>1on1を予定</h3>
            <label>
              日時（UTC）
              <input name="scheduledAt" type="datetime-local" required />
            </label>
            <label>
              テーマ
              <textarea name="theme" />
            </label>
            <button>1on1を作成</button>
          </form>
        )}
        <h2>設定済みリマインダー</h2>
        <ul>
          {data?.reminders.map((rule) => (
            <li key={rule.id}>
              {rule.reminder_type}: {rule.next_run_at} /{" "}
              {rule.enabled ? "有効" : "停止"}
              {data.canEdit && (
                <form
                  className="form"
                  onSubmit={(event) => updateReminder(event, rule)}
                >
                  <label>
                    次回日時（スヌーズを含む・UTC）
                    <input
                      name="nextRunAt"
                      type="datetime-local"
                      defaultValue={rule.next_run_at.slice(0, 16)}
                      required
                    />
                  </label>
                  <label>
                    周期（日・任意）
                    <input
                      name="cadenceDays"
                      type="number"
                      min="1"
                      max="365"
                      defaultValue={rule.cadence_days ?? ""}
                    />
                  </label>
                  <label>
                    猶予（分）
                    <input
                      name="graceMinutes"
                      type="number"
                      min="0"
                      max="43200"
                      defaultValue={rule.grace_minutes}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="enabled"
                      value="yes"
                      defaultChecked={Boolean(rule.enabled)}
                    />{" "}
                    有効
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="stopOnCompletion"
                      value="yes"
                      defaultChecked={Boolean(rule.stop_on_completion)}
                    />{" "}
                    完了時に停止
                  </label>
                  <button>周期・停止を更新</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
