"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Unit = { id: string; name: string };
type Member = {
  id: string;
  displayName: string;
  status: string;
  version: number;
};
export default function Members() {
  const [units, setUnits] = useState<Unit[]>([]),
    [unit, setUnit] = useState(""),
    [members, setMembers] = useState<Member[]>([]),
    [state, setState] = useState("loading");
  useEffect(() => {
    fetch("/api/v1/units")
      .then(async (r) => {
        if (!r.ok) throw Error();
        const j = (await r.json()) as { data: Unit[] };
        setUnits(j.data);
        setUnit(j.data[0]?.id ?? "");
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);
  useEffect(() => {
    if (!unit) return;
    setState("loading");
    fetch(`/api/v1/units/${unit}/members`)
      .then(async (r) => {
        if (!r.ok) throw Error();
        setMembers(((await r.json()) as { data: Member[] }).data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [unit]);
  return (
    <main id="main-content">
      <section className="panel" aria-labelledby="member-title">
        <h1 id="member-title">Member一覧</h1>
        <p>本人の支援に必要な最小情報を管理します。</p>
        <label htmlFor="unit">Unit</label>
        <select
          id="unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>{" "}
        <Link
          className="button"
          href={`/members/new?unit=${encodeURIComponent(unit)}`}
        >
          Memberを登録
        </Link>
        <div role="status" aria-live="polite">
          {state === "loading" && "読み込み中です…"}
          {state === "error" &&
            "読み込めませんでした。再読み込みしてください。"}
        </div>
        {state === "ready" && members.length === 0 ? (
          <p>このUnitにはMemberが登録されていません。</p>
        ) : (
          <table>
            <caption>選択UnitのMember</caption>
            <thead>
              <tr>
                <th>氏名</th>
                <th>在籍状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.displayName}</td>
                  <td>
                    <span className="status">{m.status}</span>
                  </td>
                  <td>
                    <Link href={`/members/${m.id}`}>詳細</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
