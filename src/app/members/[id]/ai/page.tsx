"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const csrf = () =>
  document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("cc_csrf="))
    ?.slice(8) ?? "";
type Goal = { id: string; current_version_id: string; title: string };
type AiRequest = {
  id: string;
  operation: string;
  purpose: string;
  status: string;
  contextHash: string;
  redactionReport: {
    replacements: Record<string, number>;
    excludedRefs: unknown[];
    warnings: string[];
  };
  modelAlias: string;
  estimatedMicrounits: number;
  version: number;
  sanitizedText?: string;
  response?: {
    confidence_note?: string;
    unknowns_json?: string;
    warnings_json?: string;
  } | null;
  suggestions?: Array<{
    id: string;
    suggestion_type: string;
    payload_json: string;
    rationale: string;
    status: string;
    source_refs_json: string;
    version: number;
  }>;
};

export default function AiSafetyPage() {
  const memberId = String(useParams().id);
  const [goals, setGoals] = useState<Goal[]>([]),
    [current, setCurrent] = useState<AiRequest | null>(null);
  const [message, setMessage] = useState(
    "参照可能な現行データを読み込んでいます…",
  );
  useEffect(() => {
    void fetch(`/api/v1/members/${memberId}/support`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const envelope = (await response.json()) as { data: { goals: Goal[] } };
        setGoals(envelope.data.goals);
        setMessage("");
      })
      .catch(() => setMessage("AI支援の参照候補を表示できません。"));
  }, [memberId]);

  async function json(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope = (await response.json()) as {
      data?: AiRequest;
      error?: { code: string };
    };
    if (!response.ok) throw new Error(envelope.error?.code ?? "REQUEST_FAILED");
    return envelope.data!;
  }
  async function loadPreview(request: AiRequest) {
    const preview = await json(
      `/api/v1/ai/requests/${request.id}/preview`,
      "GET",
    );
    setCurrent(preview);
    return preview;
  }
  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("匿名化・最小化を検査しています…");
    try {
      const request = await json("/api/v1/ai/requests/prepare", "POST", {
        memberId,
        operation: form.get("operation"),
        purpose: form.get("purpose"),
        inputRefs: [{ type: "GOAL_VERSION", id: form.get("goalVersionId") }],
        idempotencyKey: crypto.randomUUID(),
      });
      await loadPreview(request);
      setMessage("送信予定全文を確認してください。まだ送信されていません。");
    } catch (error) {
      setMessage(
        `準備を停止しました: ${error instanceof Error ? error.message : "境界を確認してください"}。手動支援は続けられます。`,
      );
    }
  }
  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = new FormData(event.currentTarget);
    setMessage("編集後の本文を再検査しています…");
    try {
      const result = await json(
        `/api/v1/ai/requests/${current.id}/preview`,
        "PATCH",
        { version: current.version, sanitizedText: form.get("sanitizedText") },
      );
      setCurrent(result);
      setMessage("再検査しました。編集により承認は引き継がれません。");
    } catch (error) {
      setMessage(
        `再検査で停止しました: ${error instanceof Error ? error.message : "境界違反"}`,
      );
    }
  }
  async function decideRequest(action: "approve" | "reject") {
    if (!current) return;
    setMessage(
      action === "approve"
        ? "承認hashを固定し、fake provider応答を検査しています…"
        : "送信せず終了しています…",
    );
    try {
      const result = await json(
        `/api/v1/ai/requests/${current.id}/${action}`,
        "POST",
        { version: current.version },
      );
      setCurrent(result);
      setMessage(
        result.status === "BLOCKED_BUDGET"
          ? "今月のAI予算上限です。手動入力は利用できます。"
          : action === "reject"
            ? "送信せず却下しました。"
            : "検証済みのAI提案を未確定として保存しました。",
      );
    } catch (error) {
      setMessage(
        `処理できませんでした: ${error instanceof Error ? error.message : "競合"}。手動支援は続けられます。`,
      );
    }
  }
  async function decideSuggestion(
    item: NonNullable<AiRequest["suggestions"]>[number],
    decision: "ACCEPTED" | "PARTIALLY_ACCEPTED" | "REJECTED",
    editedContent?: string,
  ) {
    try {
      await json(`/api/v1/ai/suggestions/${item.id}/decision`, "POST", {
        version: item.version,
        decision,
        editedContent,
        reason:
          decision === "REJECTED"
            ? "ULが採用しないと判断"
            : "ULが人間所有draftとして確認",
      });
      const updated = await json(`/api/v1/ai/requests/${current!.id}`, "GET");
      setCurrent(updated);
      setMessage(
        "採否を記録しました。採用内容は本人確認済み事実ではなく、人間所有draftです。",
      );
    } catch (error) {
      setMessage(
        `採否を保存できませんでした: ${error instanceof Error ? error.message : "競合"}`,
      );
    }
  }
  return (
    <main id="main-content">
      <section className="panel">
        <p>
          <a href={`/members/${memberId}`}>Member詳細へ戻る</a>
        </p>
        <h1>AI支援・安全パイプライン</h1>
        <p>
          外部AIは未接続です。deterministic
          fakeだけを使用し、提案は人事評価・本人確認・確定事実を代行しません。
        </p>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {!current && (
          <form className="form" onSubmit={prepare}>
            <label>
              操作
              <select name="operation">
                <option value="QUESTION_PLAN">質問候補</option>
                <option value="WHY_EXPLORE">Why探索</option>
                <option value="GOAL_DRAFT">目標草案</option>
                <option value="SMART_AUDIT">SMART再確認</option>
                <option value="ACTION_PLAN">行動候補</option>
                <option value="ONE_ON_ONE_PREP">1on1準備</option>
                <option value="GOAL_CHANGE">目標修正候補</option>
              </select>
            </label>
            <label>
              単一の利用目的
              <input name="purpose" maxLength={500} required />
            </label>
            <label>
              参照する現行目標
              <select name="goalVersionId" required>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.current_version_id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={!goals.length}>匿名化プレビューを準備</button>
          </form>
        )}
        {current?.sanitizedText && (
          <section aria-labelledby="preview-heading">
            <h2 id="preview-heading">送信前プレビュー</h2>
            <dl>
              <dt>状態</dt>
              <dd>{current.status}</dd>
              <dt>送信先</dt>
              <dd>{current.modelAlias}</dd>
              <dt>推定費用</dt>
              <dd>{current.estimatedMicrounits} microunits</dd>
              <dt>置換</dt>
              <dd>{JSON.stringify(current.redactionReport.replacements)}</dd>
              <dt>除外</dt>
              <dd>{current.redactionReport.excludedRefs.length}件</dd>
            </dl>
            <p>
              学習・保持条件: fake
              providerのため適用なし。匿名化は完全な匿名を保証しません。
            </p>
            <form className="form" onSubmit={edit}>
              <label>
                実際の送信予定全文
                <textarea
                  name="sanitizedText"
                  defaultValue={current.sanitizedText}
                  rows={14}
                  required
                />
              </label>
              <button>編集内容を再検査</button>
            </form>
            <button onClick={() => void decideRequest("approve")}>
              全文を承認してfake送信
            </button>{" "}
            <button onClick={() => void decideRequest("reject")}>
              送信せず中止
            </button>
          </section>
        )}
        {current?.status === "SUCCEEDED" && (
          <section aria-labelledby="proposal-heading">
            <h2 id="proposal-heading">AI提案・未承認</h2>
            <p>{current.response?.confidence_note}</p>
            {current.suggestions?.map((item) => {
              const content = (
                JSON.parse(item.payload_json) as { content: string }
              ).content;
              return (
                <article className="panel" key={item.id}>
                  <h3>{item.suggestion_type}</h3>
                  <p>{content}</p>
                  <p>理由: {item.rationale}</p>
                  <p>根拠参照: {item.source_refs_json}</p>
                  <p>状態: {item.status}</p>
                  {item.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => void decideSuggestion(item, "ACCEPTED")}
                      >
                        人間所有draftとして採用
                      </button>
                      <button
                        onClick={() => {
                          const edited = window.prompt(
                            "編集後の人間所有draft",
                            content,
                          );
                          if (edited)
                            void decideSuggestion(
                              item,
                              "PARTIALLY_ACCEPTED",
                              edited,
                            );
                        }}
                      >
                        編集して部分採用
                      </button>
                      <button
                        onClick={() => void decideSuggestion(item, "REJECTED")}
                      >
                        却下
                      </button>
                    </>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}
