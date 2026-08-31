"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const csrf = () =>
  document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("cc_csrf="))
    ?.slice(8) ?? "";
type Token = {
  id: string;
  expires_at: string;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  revoked_at: string | null;
};
type Confirmation = {
  id: string;
  method: string;
  result: string;
  member_words: string;
  confirmed_at: string;
};
type Snapshot = {
  id: string;
  expires_at: string;
  revoked_at: string | null;
  version: number;
  created_at: string;
  exclusion_summary_json: string;
  tokens: Token[];
  confirmations: Confirmation[];
};
type Data = { canEdit: boolean; snapshots: Snapshot[] };

export default function SharePage() {
  const memberId = String(useParams().id),
    [data, setData] = useState<Data | null>(null),
    [preview, setPreview] = useState<{ id: string; html: string } | null>(null),
    [rawLink, setRawLink] = useState<string | null>(null),
    [message, setMessage] = useState("読み込み中です…");
  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/members/${memberId}/share-snapshots`);
    if (!response.ok) throw new Error();
    setData(((await response.json()) as { data: Data }).data);
    setMessage("");
  }, [memberId]);
  useEffect(() => {
    void load().catch(() => setMessage("共有履歴を表示できません。"));
  }, [load]);

  async function call(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as {
      data?: Record<string, unknown>;
      error?: { code: string };
    };
    if (!response.ok) throw new Error(envelope.error?.code ?? "REQUEST_FAILED");
    return envelope.data!;
  }
  async function createSnapshot() {
    setMessage("確定済み情報だけを抽出し、共有前検査をしています…");
    setRawLink(null);
    try {
      const result = await call(`/api/v1/members/${memberId}/share-snapshots`, {
        idempotencyKey: crypto.randomUUID(),
      });
      setPreview({ id: String(result.id), html: String(result.html) });
      await load();
      setMessage(
        "不変snapshotを作成しました。内容を確認してからURLを発行してください。",
      );
    } catch (error) {
      setMessage(
        `生成できませんでした: ${error instanceof Error ? error.message : "確定情報を確認してください"}`,
      );
    }
  }
  async function openPreview(id: string) {
    const response = await fetch(`/api/v1/share-snapshots/${id}/preview`);
    if (!response.ok) {
      setMessage("snapshotを表示できません。");
      return;
    }
    const result = (await response.json()) as { data: { html: string } };
    setPreview({ id, html: result.data.html });
  }
  async function issue(event: FormEvent<HTMLFormElement>, snapshot: Snapshot) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setRawLink(null);
    try {
      const result = await call(
        `/api/v1/share-snapshots/${snapshot.id}/tokens`,
        {
          version: snapshot.version,
          expiresInDays: Number(form.get("days")),
          idempotencyKey: crypto.randomUUID(),
        },
      );
      const token = result.rawToken;
      setRawLink(token ? `${window.location.origin}/s/${String(token)}` : null);
      await load();
      setMessage(
        token
          ? "共有URLを発行しました。raw tokenはこの画面で一度だけ表示します。"
          : "同じ発行要求はすでに完了しています。安全のためraw tokenは再表示しません。",
      );
    } catch (error) {
      setMessage(
        `URLを発行できませんでした: ${error instanceof Error ? error.message : "競合"}`,
      );
    }
  }
  async function revoke(snapshot: Snapshot, token: Token) {
    try {
      await call(`/api/v1/share-tokens/${token.id}/revoke`, {
        version: snapshot.version,
      });
      await load();
      setRawLink(null);
      setMessage("共有URLを即時失効しました。");
    } catch (error) {
      setMessage(
        `失効できませんでした: ${error instanceof Error ? error.message : "競合"}`,
      );
    }
  }
  async function confirm(
    event: FormEvent<HTMLFormElement>,
    snapshot: Snapshot,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await call(`/api/v1/share-snapshots/${snapshot.id}/confirmations`, {
        version: snapshot.version,
        method: form.get("method"),
        result: form.get("result"),
        memberWords: form.get("memberWords"),
        confirmedAt: `${form.get("confirmedAt")}:00.000Z`,
      });
      await load();
      setMessage(
        "本人確認の方法・結果・本人の言葉を記録しました。URL閲覧日時は確認記録として扱いません。",
      );
      event.currentTarget.reset();
    } catch (error) {
      setMessage(
        `確認記録を保存できませんでした: ${error instanceof Error ? error.message : "競合"}`,
      );
    }
  }
  return (
    <main id="main-content">
      <section className="panel">
        <p>
          <a href={`/members/${memberId}`}>Member詳細へ戻る</a>
        </p>
        <h1>本人向け共有HTML</h1>
        <p>
          生成前確認:
          本人確認済みの将来像・本人理解・現行目標・SMART・行動・成果・進捗・振り返り・合意済み1on1だけを含めます。
        </p>
        <p>
          未承認AI、AI由来draft、UL所見、未確認事項、機密、監査、他Member情報は除外します。
        </p>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {data?.canEdit && (
          <button onClick={() => void createSnapshot()}>
            確定情報からsnapshotを生成
          </button>
        )}
        {rawLink && (
          <section className="panel" aria-labelledby="raw-link">
            <h2 id="raw-link">今回だけ表示する共有URL</h2>
            <p>
              <a href={rawLink} target="_blank" rel="noreferrer">
                {rawLink}
              </a>
            </p>
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(rawLink)
                  .then(() => setMessage("共有URLをコピーしました。"))
              }
            >
              URLをコピー
            </button>
            <p>このURLを閉じた後、raw tokenは再表示されません。</p>
          </section>
        )}
        {preview && (
          <section className="panel">
            <h2>生成後プレビュー</h2>
            <p>snapshot ID: {preview.id}</p>
            <iframe
              title="本人向け共有HTMLプレビュー"
              sandbox=""
              srcDoc={preview.html}
              style={{
                width: "100%",
                minHeight: "32rem",
                border: "1px solid #ccd4e0",
              }}
            />
          </section>
        )}
        <h2>共有履歴</h2>
        {data?.snapshots.map((snapshot) => (
          <article className="panel" key={snapshot.id}>
            <h3>{snapshot.created_at}</h3>
            <p>
              期限: {snapshot.expires_at} / version: {snapshot.version} /{" "}
              {snapshot.revoked_at ? "失効" : "有効"}
            </p>
            <p>除外集計: {snapshot.exclusion_summary_json}</p>
            <button onClick={() => void openPreview(snapshot.id)}>
              不変snapshotを確認
            </button>
            {data.canEdit && !snapshot.revoked_at && (
              <form
                className="form"
                onSubmit={(event) => issue(event, snapshot)}
              >
                <label>
                  URL有効日数（7〜30日）
                  <input
                    name="days"
                    type="number"
                    min="7"
                    max="30"
                    defaultValue="7"
                    required
                  />
                </label>
                <button>確認後にURL発行</button>
              </form>
            )}
            <h4>発行URL</h4>
            <ul>
              {snapshot.tokens.map((token) => (
                <li key={token.id}>
                  期限: {token.expires_at} / 初回閲覧:{" "}
                  {token.first_viewed_at ?? "未閲覧"} / 最終閲覧:{" "}
                  {token.last_viewed_at ?? "未閲覧"} /{" "}
                  {token.revoked_at ? "失効済み" : "有効"}
                  {data.canEdit && !token.revoked_at && (
                    <button onClick={() => void revoke(snapshot, token)}>
                      即時失効
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <h4>本人確認記録</h4>
            <ul>
              {snapshot.confirmations.map((item) => (
                <li key={item.id}>
                  {item.confirmed_at}: {item.method} / {item.result} —{" "}
                  {item.member_words}
                </li>
              ))}
            </ul>
            {data.canEdit && !snapshot.revoked_at && (
              <form
                className="form"
                onSubmit={(event) => confirm(event, snapshot)}
              >
                <label>
                  確認方法
                  <select name="method">
                    <option value="IN_PERSON">対面</option>
                    <option value="VIDEO">ビデオ</option>
                    <option value="PHONE">電話</option>
                  </select>
                </label>
                <label>
                  本人の回答
                  <select name="result">
                    <option value="APPROVED">承認</option>
                    <option value="CHANGES_REQUESTED">修正希望</option>
                    <option value="ON_HOLD">保留</option>
                  </select>
                </label>
                <label>
                  確認日時（UTC）
                  <input name="confirmedAt" type="datetime-local" required />
                </label>
                <label>
                  本人の言葉
                  <textarea name="memberWords" required />
                </label>
                <button>本人確認証跡を記録</button>
              </form>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
