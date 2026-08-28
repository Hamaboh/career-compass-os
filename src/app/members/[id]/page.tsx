"use client";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  canEditMember,
  type MemberUiPrincipal,
} from "../../../lib/member/ui-policy";
const csrf = () =>
  document.cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("cc_csrf="))
    ?.slice(8) ?? "";
type Unit = { id: string; name: string };
type Detail = {
  id: string;
  displayName: string;
  employeeRef?: string;
  primaryUnitId: string;
  status: string;
  version: number;
  unitHistories: {
    id: string;
    unitId: string;
    isPrimary: boolean;
    startedOn: string;
    endedOn: null | string;
  }[];
  statusHistories: {
    id: string;
    status: string;
    startedOn: string;
    endedOn: null | string;
    reasonCode: string;
  }[];
};
export default function Detail() {
  const id = String(useParams().id),
    [data, setData] = useState<Detail | null>(null),
    [message, setMessage] = useState("読み込み中です…"),
    [units, setUnits] = useState<Unit[]>([]),
    [principal, setPrincipal] = useState<MemberUiPrincipal | null>(null);
  useEffect(() => {
    void fetch("/api/v1/me").then(async (response) => {
      if (response.ok) {
        const envelope = (await response.json()) as { data: MemberUiPrincipal };
        setPrincipal(envelope.data);
      }
    });
    void fetch("/api/v1/units").then(async (response) => {
      if (response.ok)
        setUnits(((await response.json()) as { data: Unit[] }).data);
    });
    void fetch(`/api/v1/members/${id}`)
      .then(async (response) => {
        if (!response.ok) throw Error();
        setData(((await response.json()) as { data: Detail }).data);
        setMessage("");
      })
      .catch(() => setMessage("Memberを表示できません。"));
  }, [id]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    const f = new FormData(e.currentTarget);
    const r = await fetch(`/api/v1/members/${id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrf(),
        "if-match": String(data.version),
      },
      body: JSON.stringify({
        displayName: f.get("displayName"),
        employeeRef: f.get("employeeRef"),
        version: data.version,
      }),
    });
    if (r.status === 409)
      setMessage(
        "他の更新がありました。再読み込みして変更を確認してください。",
      );
    else if (r.ok) {
      setMessage("更新しました。");
      setData(((await r.json()) as { data: Detail }).data);
    } else setMessage("更新できませんでした。");
  }
  async function addHistory(
    e: FormEvent<HTMLFormElement>,
    kind: "unit" | "status",
  ) {
    e.preventDefault();
    if (!data) return;
    const f = new FormData(e.currentTarget);
    const body =
      kind === "unit"
        ? {
            unitId: f.get("unitId"),
            isPrimary: f.get("assignment") === "primary",
            startedOn: f.get("startedOn"),
            source: "MANUAL",
            version: data.version,
          }
        : {
            status: f.get("status"),
            startedOn: f.get("startedOn"),
            reasonCode: f.get("reasonCode"),
            version: data.version,
          };
    const response = await fetch(
      `/api/v1/members/${id}/${kind === "unit" ? "unit-histories" : "status-histories"}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify(body),
      },
    );
    if (response.status === 409)
      setMessage(
        "履歴または版が競合しました。期間を確認して再読み込みしてください。",
      );
    else if (response.ok) {
      setData(((await response.json()) as { data: Detail }).data);
      setMessage("履歴を追加しました。");
      e.currentTarget.reset();
    } else
      setMessage("履歴を追加できませんでした。入力と権限を確認してください。");
  }
  const editable = data ? canEditMember(principal, data.primaryUnitId) : false;
  return (
    <main id="main-content">
      <section className="panel">
        <h1>Member詳細</h1>
        <p>
          <a href={`/members/${id}/self-analysis`}>本人理解・将来像を開く</a>
        </p>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {data && (
          <>
            {editable ? (
              <form className="form" onSubmit={save}>
                <label htmlFor="name">氏名</label>
                <input
                  id="name"
                  name="displayName"
                  defaultValue={data.displayName}
                  required
                />
                <label htmlFor="ref">社員照合ID（非公開）</label>
                <input
                  id="ref"
                  name="employeeRef"
                  defaultValue={data.employeeRef}
                  required
                />
                <p>
                  在籍状態: <span className="status">{data.status}</span>
                </p>
                <button>基本情報を更新</button>
              </form>
            ) : (
              <section aria-labelledby="readonly-member">
                <h2 id="readonly-member">基本情報</h2>
                <p>氏名: {data.displayName}</p>
                <p>
                  在籍状態: <span className="status">{data.status}</span>
                </p>
                <p>このMemberは閲覧のみ可能です。</p>
              </section>
            )}
            <h2>所属履歴</h2>
            {data.unitHistories.length ? (
              <ul>
                {data.unitHistories.map((h) => (
                  <li key={h.id}>
                    {h.isPrimary ? "主所属" : "兼務"}: {h.startedOn}〜
                    {h.endedOn ?? "現在"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>所属履歴はありません。</p>
            )}
            <h2>状態履歴</h2>
            {data.statusHistories.length ? (
              <ul>
                {data.statusHistories.map((h) => (
                  <li key={h.id}>
                    {h.status}: {h.startedOn}〜{h.endedOn ?? "現在"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>状態履歴はありません。</p>
            )}
            {editable && (
              <section aria-labelledby="history-mutations">
                <h2 id="history-mutations">履歴を追加</h2>
                <h3>所属履歴を追加</h3>
                <form
                  className="form"
                  onSubmit={(e) => void addHistory(e, "unit")}
                >
                  <label htmlFor="history-unit">Unit</label>
                  <select id="history-unit" name="unitId" required>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="assignment">所属種別</label>
                  <select id="assignment" name="assignment">
                    <option value="primary">主所属</option>
                    <option value="secondary">兼務</option>
                  </select>
                  <label htmlFor="unit-started">開始日</label>
                  <input
                    id="unit-started"
                    name="startedOn"
                    type="date"
                    required
                  />
                  <button type="submit">所属履歴を追加</button>
                </form>
                <h3>状態履歴を追加</h3>
                <form
                  className="form"
                  onSubmit={(e) => void addHistory(e, "status")}
                >
                  <label htmlFor="member-status">状態</label>
                  <select id="member-status" name="status">
                    <option value="ACTIVE">在籍・再入社</option>
                    <option value="ON_LEAVE">休職</option>
                    <option value="LEFT">退職</option>
                    <option value="OUT_OF_SCOPE">対象外</option>
                  </select>
                  <label htmlFor="status-started">開始日</label>
                  <input
                    id="status-started"
                    name="startedOn"
                    type="date"
                    required
                  />
                  <label htmlFor="reason">理由コード</label>
                  <input
                    id="reason"
                    name="reasonCode"
                    required
                    maxLength={50}
                  />
                  <button type="submit">状態履歴を追加</button>
                </form>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
