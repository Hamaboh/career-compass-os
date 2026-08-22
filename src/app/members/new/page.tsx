"use client";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
const csrf = () =>
  document.cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("cc_csrf="))
    ?.slice(8) ?? "";
export default function NewMember() {
  const unit = useSearchParams().get("unit") ?? "";
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("保存中です…");
    const f = new FormData(e.currentTarget);
    const body = {
      employeeRef: f.get("employeeRef"),
      displayName: f.get("displayName"),
      joinedOn: f.get("joinedOn"),
      primaryUnitStartedOn: f.get("startedOn"),
    };
    const r = await fetch(`/api/v1/units/${unit}/members`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body),
    });
    if (r.ok) setMessage("登録しました。");
    else {
      const j = (await r.json()) as { error?: { code?: string } };
      setMessage(
        r.status === 409
          ? "競合しました。入力を確認してください。"
          : j.error?.code === "VALIDATION_ERROR"
            ? "入力内容を確認してください。"
            : "登録できませんでした。",
      );
    }
  }
  return (
    <main id="main-content">
      <form
        className="panel form"
        onSubmit={submit}
        aria-labelledby="new-title"
      >
        <h1 id="new-title">Member登録</h1>
        <p>Member本人のログインアカウントは作成しません。</p>
        <label htmlFor="name">氏名</label>
        <input id="name" name="displayName" required maxLength={100} />
        <label htmlFor="ref">社員照合ID（非公開）</label>
        <input id="ref" name="employeeRef" required maxLength={100} />
        <label htmlFor="joined">入社日</label>
        <input id="joined" name="joinedOn" type="date" required />
        <label htmlFor="started">主所属開始日</label>
        <input id="started" name="startedOn" type="date" required />
        <button type="submit" disabled={!unit}>
          登録する
        </button>
        <p role="status" tabIndex={-1}>
          {message}
        </p>
      </form>
    </main>
  );
}
