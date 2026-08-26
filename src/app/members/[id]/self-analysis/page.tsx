"use client";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
const csrf = () =>
  document.cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("cc_csrf="))
    ?.slice(8) ?? "";
type Entry = {
  id: string;
  question_id: string | null;
  response_status: string;
  response_text: string | null;
  provenance_type: string;
  confidentiality: string;
  visibility: string;
  ai_send_policy: string;
  version: number;
};
type Vision = {
  id: string;
  kind: string;
  statement: string;
  status: string;
  provenance_type: string;
  version: number;
};
type Data = {
  canEdit: boolean;
  sessions: {
    id: string;
    route_type: string;
    status: string;
    version: number;
  }[];
  questions: {
    id: string;
    session_id: string;
    domain: string;
    prompt_text: string;
    position: number;
    version: number;
  }[];
  entries: Entry[];
  entryHistory: Entry[];
  futureVisions: Vision[];
};
const labels: Record<string, string> = {
  MEMBER_STATEMENT: "本人発言",
  UL_OBSERVATION: "UL所見",
  AI_HYPOTHESIS: "AI仮説（未確認）",
  MEMBER_CONFIRMED: "本人確認済み",
  UNANSWERED: "未回答",
  UNKNOWN: "分からない",
  DECLINED: "答えたくない",
  ON_HOLD: "保留",
  SKIPPED: "スキップ",
  ANSWERED: "回答済み",
};
export default function SelfAnalysis() {
  const id = String(useParams().id),
    [data, setData] = useState<Data | null>(null),
    [message, setMessage] = useState("読み込み中です…"),
    [editable, setEditable] = useState(false),
    [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  useEffect(() => {
    void fetch(`/api/v1/members/${id}/self-analysis/sessions`)
      .then(async (r) => {
        if (!r.ok) throw Error();
        const envelope = (await r.json()) as { data: Data };
        setData(envelope.data);
        setEditable(envelope.data.canEdit);
        setMessage("");
      })
      .catch(() =>
        setMessage("本人理解を表示できません。再試行してください。"),
      );
  }, [id]);
  async function send(url: string, body: unknown, method = "POST") {
    setMessage("保存中です…");
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body),
    });
    if (r.status === 409) {
      setMessage("他の更新があります。再読み込みして差分を確認してください。");
      return;
    }
    if (!r.ok) {
      setMessage("保存できませんでした。入力と権限を確認してください。");
      return;
    }
    setData(((await r.json()) as { data: Data }).data);
    setMessage("保存しました。");
  }
  function session(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void send(`/api/v1/members/${id}/self-analysis/sessions`, {
      routeType: f.get("routeType"),
      status: "ACTIVE",
    });
  }
  function entry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data?.sessions[0]) return;
    const f = new FormData(e.currentTarget),
      status = String(f.get("responseStatus")),
      confidential = f.get("confidentiality") === "CONFIDENTIAL";
    void send(
      `/api/v1/self-analysis/sessions/${data.sessions[0].id}/entries`,
      {
        ...(editingEntry
          ? { entryId: editingEntry.id, version: editingEntry.version }
          : {}),
        questionId: f.get("questionId") || null,
        responseStatus: status,
        responseText: status === "ANSWERED" ? f.get("responseText") : null,
        provenanceType: f.get("provenanceType"),
        confidentiality: confidential ? "CONFIDENTIAL" : "NORMAL",
        visibility: confidential ? "UL_ONLY" : "UL_AND_EXEC",
        aiSendPolicy: confidential ? "AI_SEND_PROHIBITED" : "AI_SEND_ALLOWED",
      },
      editingEntry ? "PATCH" : "POST",
    );
    setEditingEntry(null);
  }
  function question(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data?.sessions[0]) return;
    const f = new FormData(e.currentTarget),
      sessionId = data.sessions[0].id;
    void send(`/api/v1/self-analysis/sessions/${sessionId}/questions`, {
      domain: f.get("domain"),
      promptText: f.get("promptText"),
      position:
        data.questions.filter((item) => item.session_id === sessionId).length +
        1,
    });
    e.currentTarget.reset();
  }
  function transition(status: string) {
    const current = data?.sessions[0];
    if (!current) return;
    void send(`/api/v1/self-analysis/sessions/${current.id}/transition`, {
      status,
      version: current.version,
    });
  }
  function vision(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      kind = String(f.get("kind")),
      status = String(f.get("status"));
    const latest = Math.max(
      0,
      ...(data?.futureVisions
        .filter((v) => v.kind === kind)
        .map((v) => v.version) ?? []),
    );
    void send(`/api/v1/members/${id}/future-visions`, {
      kind,
      statement: f.get("statement"),
      status,
      provenanceType:
        status === "MEMBER_CONFIRMED"
          ? "MEMBER_CONFIRMED"
          : f.get("provenanceType"),
      evidenceEntryIds: f.getAll("evidence"),
      confidentiality: "NORMAL",
      visibility: "UL_AND_EXEC",
      aiSendPolicy: "AI_SEND_ALLOWED",
      expectedVersion: latest,
    });
  }
  const currentSession = data?.sessions[0];
  const currentQuestions = (data?.questions ?? []).filter(
    (item) => item.session_id === currentSession?.id,
  );
  const unansweredQuestions = currentQuestions
    .filter(
      (item) =>
        !data?.entries.some(
          (entryItem) =>
            entryItem.question_id === item.id &&
            entryItem.response_status !== "UNANSWERED",
        ),
    )
    .slice(0, 3);
  return (
    <main id="main-content">
      <section className="panel">
        <p>
          <a href={`/members/${id}`}>Member詳細へ戻る</a>
        </p>
        <h1>本人理解・将来像</h1>
        <p>
          AI接続なしで、ULが本人との対話を代理入力します。回答拒否や保留も正常な選択です。
        </p>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {!data?.sessions.length && (
          <p>
            自己分析セッションはまだありません。必要な範囲から始められます。
          </p>
        )}
        {editable && (
          <form className="form" onSubmit={session}>
            <h2>セッションを開始</h2>
            <label htmlFor="route">入口</label>
            <select id="route" name="routeType">
              <option value="EXPLORE">じっくり探索</option>
              <option value="DIRECTION">方向性から</option>
              <option value="DIRECT_GOAL">
                明確な目標あり（自己分析を省略）
              </option>
              <option value="HOLD">今は保留</option>
            </select>
            <button>開始する</button>
          </form>
        )}
        {editable && currentSession && (
          <section aria-labelledby="manual-questions">
            <h2 id="manual-questions">手動質問フロー</h2>
            <p>一度に表示する次の質問は最大3問です。</p>
            <form className="form" onSubmit={question}>
              <label htmlFor="questionDomain">質問テーマ</label>
              <select id="questionDomain" name="domain">
                <option value="EXPERIENCE">経験</option>
                <option value="EMOTION">感情</option>
                <option value="STRENGTH">強み</option>
                <option value="VALUE">価値観</option>
                <option value="LIFE">生活上の希望</option>
                <option value="CAREER">キャリア</option>
                <option value="FUTURE">将来像</option>
              </select>
              <label htmlFor="promptText">本人へ確認する質問</label>
              <textarea id="promptText" name="promptText" required rows={2} />
              <button>次の質問として追加</button>
            </form>
            <h3>次に確認する質問</h3>
            {unansweredQuestions.length ? (
              <ol>
                {unansweredQuestions.map((item) => (
                  <li key={item.id}>
                    <span className="status">{item.domain}</span>{" "}
                    {item.prompt_text}
                  </li>
                ))}
              </ol>
            ) : (
              <p>次の質問はありません。必要な場合だけ追加してください。</p>
            )}
            <p>現在のセッション: {currentSession.status}</p>
            <button type="button" onClick={() => transition("COMPLETED")}>
              完了
            </button>{" "}
            <button type="button" onClick={() => transition("ON_HOLD")}>
              保留
            </button>{" "}
            <button type="button" onClick={() => transition("ACTIVE")}>
              再開
            </button>
          </section>
        )}
        <h2>回答履歴</h2>
        {!data?.entries.length ? (
          <p>回答はまだありません。</p>
        ) : (
          <ul>
            {data.entries.map((x) => (
              <li key={x.id}>
                <strong>{labels[x.provenance_type]}</strong> —{" "}
                {labels[x.response_status]}{" "}
                {x.response_text && <span>「{x.response_text}」</span>}{" "}
                <span className="status">{x.confidentiality}</span> v{x.version}
                <span>
                  {" "}
                  / {x.visibility} / {x.ai_send_policy}
                </span>{" "}
                {editable && (
                  <button type="button" onClick={() => setEditingEntry(x)}>
                    この記録を編集
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {data?.entryHistory.length ? (
          <details>
            <summary>変更前の版を表示</summary>
            <ul>
              {data.entryHistory.map((item) => (
                <li key={item.id}>
                  v{item.version} {labels[item.provenance_type]} /{" "}
                  {labels[item.response_status]} / {item.confidentiality} /{" "}
                  {item.ai_send_policy}
                  {item.response_text && <span>「{item.response_text}」</span>}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {editable && data?.sessions.length ? (
          <form className="form" onSubmit={entry}>
            <h2>{editingEntry ? "回答・所見を編集" : "質問への回答・所見"}</h2>
            <label htmlFor="questionId">対応する質問</label>
            <select
              id="questionId"
              name="questionId"
              defaultValue={editingEntry?.question_id ?? ""}
              key={editingEntry?.id ?? "new-entry"}
            >
              <option value="">質問に紐付けない所見</option>
              {currentQuestions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.position}. {item.prompt_text}
                </option>
              ))}
            </select>
            <label htmlFor="responseStatus">回答状態</label>
            <select
              id="responseStatus"
              name="responseStatus"
              defaultValue={editingEntry?.response_status ?? "ANSWERED"}
              key={`status-${editingEntry?.id ?? "new"}`}
            >
              <option value="ANSWERED">回答済み</option>
              <option value="UNANSWERED">未回答</option>
              <option value="UNKNOWN">分からない</option>
              <option value="DECLINED">答えたくない</option>
              <option value="ON_HOLD">保留</option>
              <option value="SKIPPED">スキップ</option>
            </select>
            <label htmlFor="responseText">本文（回答済みの場合のみ）</label>
            <textarea
              id="responseText"
              name="responseText"
              rows={4}
              defaultValue={editingEntry?.response_text ?? ""}
            />
            <label htmlFor="provenance">情報の出所</label>
            <select
              id="provenance"
              name="provenanceType"
              defaultValue={editingEntry?.provenance_type ?? "MEMBER_STATEMENT"}
              key={`provenance-${editingEntry?.id ?? "new"}`}
            >
              <option value="MEMBER_STATEMENT">本人発言</option>
              <option value="UL_OBSERVATION">UL所見</option>
              <option value="MEMBER_CONFIRMED">本人確認済み事実</option>
            </select>
            <p>AI仮説はAI接続を実装するまで生成しません。</p>
            <label htmlFor="confidentiality">機密区分</label>
            <select
              id="confidentiality"
              name="confidentiality"
              defaultValue={editingEntry?.confidentiality ?? "NORMAL"}
              key={`confidentiality-${editingEntry?.id ?? "new"}`}
            >
              <option value="NORMAL">通常</option>
              <option value="CONFIDENTIAL">機密（UL限定・AI送信不可）</option>
            </select>
            <button>回答を保存</button>
          </form>
        ) : null}
        <h2>将来像・価値観・キャリア方向</h2>
        {!data?.futureVisions.length ? (
          <p>将来像はまだありません。仮説や保留のまま保存できます。</p>
        ) : (
          <ul>
            {data.futureVisions.map((v) => (
              <li key={v.id}>
                <strong>{v.kind}</strong>{" "}
                <span className="status">{v.status}</span>{" "}
                <span>{labels[v.provenance_type]}</span>
                <p>{v.statement}</p>
                <small>版 {v.version}</small>
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form className="form" onSubmit={vision}>
            <h2>将来像等の新版を作成</h2>
            <label htmlFor="kind">種類</label>
            <select id="kind" name="kind">
              <option value="FUTURE_VISION">将来像</option>
              <option value="VALUE">価値観</option>
              <option value="CAREER_DIRECTION">キャリア方向</option>
            </select>
            <label htmlFor="statement">内容</label>
            <textarea id="statement" name="statement" required rows={4} />
            <label htmlFor="visionStatus">状態</label>
            <select id="visionStatus" name="status">
              <option value="HYPOTHESIS">仮説</option>
              <option value="MEMBER_CONFIRMED">本人確認済み</option>
              <option value="ON_HOLD">保留</option>
            </select>
            <label htmlFor="visionProvenance">出所</label>
            <select id="visionProvenance" name="provenanceType">
              <option value="MEMBER_STATEMENT">本人発言</option>
              <option value="UL_OBSERVATION">UL所見</option>
            </select>
            <fieldset>
              <legend>根拠となるentry（任意）</legend>
              {data?.entries.map((x) => (
                <label key={x.id}>
                  <input type="checkbox" name="evidence" value={x.id} />
                  {labels[x.provenance_type]}:{" "}
                  {x.response_text ?? labels[x.response_status]}
                </label>
              ))}
            </fieldset>
            <button>新版を保存</button>
          </form>
        )}
      </section>
    </main>
  );
}
