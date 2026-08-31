"use client";

import { FormEvent, useEffect, useState } from "react";

const csrf = () =>
  document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("cc_csrf="))
    ?.slice(8) ?? "";

type Unit = {
  id: string;
  code: string;
  name: string;
  member_count: number;
  open_reviews: number;
};
type Review = {
  id: string;
  target_type: string;
  target_id: string;
  unit_code: string;
  unit_name: string;
  status: string;
  version: number;
  revision_no: number;
  comments: Array<{
    id: string;
    body: string;
    disposition: string;
    created_at: string;
  }>;
};
type Policy = {
  id: string;
  type: string;
  source_name: string;
  version: number;
  historic_link_count: number;
};
type PolicyVersion = {
  id: string;
  document_id: string;
  version_no: string;
  status: string;
  effective_from: string;
  historic_link_count: number;
};
type PolicyItem = {
  id: string;
  policy_version_id: string;
  category: string;
  code: string;
  title: string;
  draft: number;
};

export default function ExecutivePage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [documents, setDocuments] = useState<Policy[]>([]);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [items, setItems] = useState<PolicyItem[]>([]);
  const [message, setMessage] = useState("読み込み中です…");

  async function load() {
    try {
      const [overviewResponse, reviewResponse, policyResponse] =
        await Promise.all([
          fetch("/api/v1/executive/overview"),
          fetch("/api/v1/reviews"),
          fetch("/api/v1/policy-documents"),
        ]);
      if (!overviewResponse.ok || !reviewResponse.ok || !policyResponse.ok)
        throw new Error("not_visible");
      const overview = (await overviewResponse.json()) as {
        data: { units: Unit[] };
      };
      const reviewData = (await reviewResponse.json()) as { data: Review[] };
      const policyData = (await policyResponse.json()) as {
        data: {
          documents: Policy[];
          versions: PolicyVersion[];
          items: PolicyItem[];
        };
      };
      setUnits(overview.data.units);
      setReviews(reviewData.data);
      setDocuments(policyData.data.documents);
      setVersions(policyData.data.versions);
      setItems(policyData.data.items);
      setMessage("");
    } catch {
      setMessage("上位レビュー情報を表示できません。権限を確認してください。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function send(path: string, body: unknown) {
    setMessage("保存中です…");
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body),
    });
    if (response.status === 409) {
      setMessage("別の利用者が先に更新しました。再読み込みして履歴を確認してください。");
      return;
    }
    if (!response.ok) {
      setMessage("保存できませんでした。権限、対象revision、状態を確認してください。");
      return;
    }
    await load();
    setMessage("保存しました。");
  }

  function comment(event: FormEvent<HTMLFormElement>, review: Review) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send("/api/v1/reviews/" + review.id + "/comments", {
      version: review.version,
      disposition: form.get("disposition"),
      body: form.get("body"),
    });
  }

  function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send("/api/v1/policy-documents", {
      type: form.get("type"),
      sourceName: form.get("sourceName"),
      sourceRef: form.get("sourceRef"),
      owner: form.get("owner"),
    });
  }

  function turnover(event: FormEvent<HTMLFormElement>, unitId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send("/api/v1/units/" + unitId + "/turnover-calculations", {
      periodStart: form.get("periodStart"),
      periodEnd: form.get("periodEnd"),
    });
  }

  return (
    <main id="main-content">
      <section className="panel">
        <h1>全Unitレビュー・制度参考情報</h1>
        <p className="status">参考情報であり正式評価ではありません</p>
        <p>
          人の順位付け、離職予測、意欲・心理状態の推定、人事評価・給与の確定には使用しません。
          機密本文と未承認AI仮説は表示しません。
        </p>
        <p role="status" aria-live="polite">{message}</p>
      </section>

      <section className="panel" aria-labelledby="units-heading">
        <h2 id="units-heading">全Unit overview</h2>
        <table>
          <thead>
            <tr><th>Unit</th><th>現在Member数</th><th>未完了レビュー</th><th>参考退職率を算出</th></tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id}>
                <td>{unit.code} / {unit.name}</td>
                <td>{unit.member_count}</td>
                <td>{unit.open_reviews}</td>
                <td>
                  <form onSubmit={(event) => turnover(event, unit.id)}>
                    <label>期間開始<input name="periodStart" type="date" required /></label>
                    <label>期間終了<input name="periodEnd" type="date" required /></label>
                    <button>参考計算</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!units.length && <p>表示できるUnitはありません。</p>}
      </section>

      <section className="panel" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading">レビュー受信箱</h2>
        <p>元データを直接編集せず、コメント・修正依頼・対応確認だけを記録します。</p>
        {reviews.map((review) => (
          <article className="panel" key={review.id}>
            <h3>{review.unit_code} / {review.target_type}</h3>
            <p>
              <span className="status">{review.status}</span> 対象revision:
              {review.revision_no} / 対象ID: {review.target_id}
            </p>
            <ol>
              {review.comments.map((item) => (
                <li key={item.id}>
                  {item.created_at} [{item.disposition}] {item.body}
                </li>
              ))}
            </ol>
            {review.status !== "CONFIRMED" && (
              <form className="form" onSubmit={(event) => comment(event, review)}>
                <label>
                  action
                  <select name="disposition">
                    <option value="COMMENT">コメント</option>
                    <option value="RETURN">修正依頼として差戻し</option>
                    <option value="CONFIRM">対応を確認済み</option>
                    <option value="UL_RESPONSE">UL対応済み（ULのみ）</option>
                  </select>
                </label>
                <label>
                  確認点・修正理由・対応内容
                  <textarea name="body" required maxLength={4000} />
                </label>
                <button>レビュー履歴へ追加</button>
              </form>
            )}
          </article>
        ))}
        {!reviews.length && <p>レビュー依頼はありません。</p>}
      </section>

      <section className="panel" aria-labelledby="policies-heading">
        <h2 id="policies-heading">制度資料管理</h2>
        <p>
          個人評価制度とUnit Leaders Missionは分離します。新版登録は過去の目標linkを変更しません。
        </p>
        <table>
          <thead><tr><th>種別</th><th>原本</th><th>version</th><th>過去link</th></tr></thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>{document.type}</td><td>{document.source_name}</td>
                <td>{document.version}</td><td>{document.historic_link_count}件</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>版・項目preview</h3>
        {versions.map((version) => (
          <article key={version.id}>
            <h4>{version.version_no} / {version.status} / {version.effective_from}</h4>
            <p>この版への固定link: {version.historic_link_count}件</p>
            <ul>
              {items.filter((item) => item.policy_version_id === version.id).map((item) => (
                <li key={item.id}>
                  {item.code}: {item.title}{" "}
                  {item.draft === 1 && <strong className="status">DRAFT / Management</strong>}
                </li>
              ))}
            </ul>
          </article>
        ))}
        <details>
          <summary>制度原本を登録（SYSTEM_ADMIN）</summary>
          <form className="form" onSubmit={createDocument}>
            <label>制度種別
              <select name="type">
                <option value="INDIVIDUAL_EVALUATION">個人評価制度</option>
                <option value="UNIT_LEADERS_MISSION">Unit Leaders Mission</option>
              </select>
            </label>
            <label>原本名<input name="sourceName" required /></label>
            <label>参照先<input name="sourceRef" /></label>
            <label>管理責任者<input name="owner" required /></label>
            <button>原本メタデータを登録</button>
          </form>
        </details>
      </section>
    </main>
  );
}
