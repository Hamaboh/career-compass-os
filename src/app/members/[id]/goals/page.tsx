"use client";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
const token = () =>
  document.cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("cc_csrf="))
    ?.slice(8) ?? "";
type Goal = {
  id: string;
  title: string;
  description: string;
  entry_route: string;
  lifecycle_status: string;
  version: number;
  target_date: string | null;
  success_criteria: string;
  provenance_type: string;
  versions: { version_no: number; title: string; status: string }[];
  actions: { id: string; title: string; status: string }[];
  evidence: { id: string; description: string; kind: string }[];
};
type Data = { canEdit: boolean; goals: Goal[] };
export default function Goals() {
  const memberId = String(useParams().id),
    [data, setData] = useState<Data | null>(null),
    [message, setMessage] = useState("読み込み中です…");
  const url = `/api/v1/members/${memberId}/goals`;
  useEffect(() => {
    void fetch(url)
      .then(async (r) => {
        if (!r.ok) throw Error();
        setData(((await r.json()) as { data: Data }).data);
        setMessage("");
      })
      .catch(() => setMessage("目標を表示できません。"));
  }, [url]);
  async function send(path: string, body: unknown) {
    setMessage("保存中です…");
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": token() },
      body: JSON.stringify(body),
    });
    if (r.status === 409) {
      setMessage(
        "他の更新または整合性競合があります。再読み込みして差分を確認してください。",
      );
      return;
    }
    if (!r.ok) {
      setMessage(
        "保存できませんでした。入力、SMART、本人確認、権限を確認してください。",
      );
      return;
    }
    setData(((await r.json()) as { data: Data }).data);
    setMessage("保存しました。");
  }
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      conf = f.get("confidentiality") === "CONFIDENTIAL";
    void send(url, {
      entryRoute: f.get("entryRoute"),
      title: f.get("title"),
      description: f.get("description"),
      targetDate: f.get("targetDate") || null,
      successCriteria: f.get("successCriteria"),
      reviewCycle: f.get("reviewCycle") || null,
      provenanceType: f.get("provenanceType"),
      confidentiality: conf ? "CONFIDENTIAL" : "NORMAL",
      visibility: conf ? "UL_ONLY" : "UL_AND_EXEC",
      aiSendPolicy: conf ? "AI_SEND_PROHIBITED" : "AI_SEND_ALLOWED",
      links: [],
    });
  }
  function confirm(e: FormEvent<HTMLFormElement>, g: Goal) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      status = (n: string) => f.get(n);
    void send(`${url}/${g.id}/confirm`, {
      version: g.version,
      memberWords: f.get("memberWords"),
      method: f.get("method"),
      confirmedAt: new Date().toISOString(),
      checks: Array(7).fill(true),
      smart: {
        specific: status("specific"),
        measurable: status("measurable"),
        achievable: status("achievable"),
        relevant: status("relevant"),
        timeBound: status("timeBound"),
        reasons: { manual: String(f.get("reason")) },
        exceptionReason: f.get("exceptionReason") || null,
        alternativeReviewMethod: f.get("alternativeReviewMethod") || null,
        exceptionReviewDate: f.get("exceptionReviewDate") || null,
      },
    });
  }
  return (
    <main id="main-content">
      <section className="panel">
        <p>
          <a href={`/members/${memberId}`}>Member詳細へ戻る</a>
        </p>
        <h1>目標・SMART</h1>
        <p>
          本人の幸福、生活、将来像、Whyを起点にします。KPI・Missionとの接続は任意です。AIなしでも全操作を継続できます。
        </p>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {data?.canEdit && (
          <form className="form" onSubmit={create}>
            <h2>対話型Goal wizard</h2>
            <label htmlFor="entry">入口</label>
            <select id="entry" name="entryRoute">
              <option value="EXPLORE">探索から始める</option>
              <option value="DIRECTION">曖昧な方向性を整理する</option>
              <option value="DIRECT_GOAL">
                明確な目標から始める（ショートカット）
              </option>
              <option value="HOLD">今は作らない・再確認する</option>
            </select>
            <label>
              目標
              <input name="title" required maxLength={200} />
            </label>
            <label>
              望む生活・将来像・Why
              <textarea name="description" maxLength={4000} />
            </label>
            <label>
              達成基準
              <textarea name="successCriteria" />
            </label>
            <label>
              期限
              <input name="targetDate" type="date" />
            </label>
            <label>
              確認周期
              <input name="reviewCycle" placeholder="例: 月1回" />
            </label>
            <label>
              情報の出所
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
              />
              機密（UL限定・AI送信禁止）
            </label>
            <p>
              制度リンクは作成後に任意で追加できます。未接続でも保存できます。
            </p>
            <button>下書きを作成</button>
          </form>
        )}
        <h2>Goal一覧・版履歴</h2>
        {!data?.goals.length ? (
          <p>目標はまだありません。無理に作る必要はありません。</p>
        ) : (
          data.goals.map((g) => (
            <article className="panel" key={g.id}>
              <h3>{g.title}</h3>
              <p>
                <span className="status">{g.lifecycle_status}</span> / 出所:{" "}
                {g.provenance_type}
              </p>
              <p>{g.description}</p>
              <p>
                達成基準: {g.success_criteria || "未入力"} / 期限:{" "}
                {g.target_date || "合理的例外を検討"}
              </p>
              <details>
                <summary>版履歴</summary>
                <ul>
                  {g.versions.map((v) => (
                    <li key={v.version_no}>
                      第{v.version_no}版: {v.title}（{v.status}）
                    </li>
                  ))}
                </ul>
              </details>
              {data?.canEdit && g.lifecycle_status === "DRAFT" && (
                <form className="form" onSubmit={(e) => confirm(e, g)}>
                  <h4>SMART reviewと本人の明示承認</h4>
                  {[
                    "specific",
                    "measurable",
                    "achievable",
                    "relevant",
                    "timeBound",
                  ].map((axis) => (
                    <label key={axis}>
                      {axis}
                      <select name={axis}>
                        <option value="OK">OK</option>
                        <option value="NEEDS_IMPROVEMENT">要改善</option>
                        <option value="MISSING">不足</option>
                      </select>
                    </label>
                  ))}
                  <label>
                    軸別の理由
                    <textarea name="reason" required />
                  </label>
                  <fieldset>
                    <legend>
                      不足・要改善を残す合理的例外（該当時は3項目すべて必須）
                    </legend>
                    <label>
                      理由
                      <textarea name="exceptionReason" />
                    </label>
                    <label>
                      代替確認方法
                      <textarea name="alternativeReviewMethod" />
                    </label>
                    <label>
                      再確認日
                      <input type="date" name="exceptionReviewDate" />
                    </label>
                  </fieldset>
                  <label>
                    確認方法
                    <select name="method">
                      <option value="IN_PERSON">対面</option>
                      <option value="VIDEO">ビデオ</option>
                      <option value="PHONE">電話</option>
                    </select>
                  </label>
                  <label>
                    本人の言葉
                    <textarea name="memberWords" required />
                  </label>
                  <p>
                    7つの確認事項（本人が望む目標、Why、生活・将来像、任意制度接続、達成基準、期限/例外、次の行動）を対話で確認してから記録してください。URL閲覧は承認ではありません。
                  </p>
                  <button>本人承認とSMART監査を記録して確定</button>
                </form>
              )}
              <h4>Action plan / Evidence</h4>
              <p>
                {g.actions.length
                  ? g.actions.map((a) => `${a.title}（${a.status}）`).join("、")
                  : "行動はまだありません。APIから現行版に追加できます。"}
              </p>
              <ul>
                {g.evidence.map((e) => (
                  <li key={e.id}>
                    {e.kind}: {e.description}
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
