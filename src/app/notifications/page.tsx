"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const csrf = () =>
  document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("cc_csrf="))
    ?.slice(8) ?? "";
type Notification = {
  id: string;
  type: string;
  member_id: string;
  scheduled_at: string;
  status: string;
  items: Array<{ type: string; subject_type: string; subject_id: string }>;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [message, setMessage] = useState("読み込み中です…");
  const load = () =>
    void fetch("/api/v1/notifications")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setItems(((await response.json()) as { data: Notification[] }).data);
        setMessage("");
      })
      .catch(() => setMessage("通知を表示できません。"));
  useEffect(load, []);
  async function post(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) setMessage("処理できませんでした。");
    else {
      const payload = (await response.json()) as {
        data: Notification[] | { notifications: Notification[] };
      };
      setItems(
        Array.isArray(payload.data) ? payload.data : payload.data.notifications,
      );
      setMessage("更新しました。");
    }
  }
  return (
    <main id="main-content">
      <section className="panel">
        <p>
          <Link href="/members">Member一覧へ</Link>
        </p>
        <h1>通知・要対応</h1>
        <p>
          期限や未回答は確認対象であり、人事評価や意欲の判定ではありません。
        </p>
        <p role="status" aria-live="polite">
          {message}
        </p>
        <button onClick={() => void post("/api/v1/reminder-jobs/run")}>
          期限到来通知を確認
        </button>
        {!items.length ? (
          <p>現在、対応が必要な通知はありません。</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                {item.type} / {item.scheduled_at} /{" "}
                <span className="status">{item.status}</span>
                <ul>
                  {item.items.map((detail) => (
                    <li key={`${detail.type}:${detail.subject_id}`}>
                      {detail.type}（{detail.subject_type}）
                    </li>
                  ))}
                </ul>
                {item.status !== "READ" && (
                  <button
                    onClick={() =>
                      void post(`/api/v1/notifications/${item.id}/read`)
                    }
                  >
                    既読にする
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
