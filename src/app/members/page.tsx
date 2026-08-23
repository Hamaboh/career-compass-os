"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { memberPageUrl } from "../../lib/member/ui-policy";
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
    [state, setState] = useState("loading"),
    [cursor, setCursor] = useState<string | null>(null),
    [nextCursor, setNextCursor] = useState<string | null>(null),
    [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);
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
    fetch(memberPageUrl(unit, cursor))
      .then(async (r) => {
        if (!r.ok) throw Error();
        const page = (await r.json()) as {
          data: Member[];
          meta: { nextCursor: string | null };
        };
        setMembers(page.data);
        setNextCursor(page.meta.nextCursor);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [unit, cursor]);
  return (
    <main id="main-content">
      <section className="panel" aria-labelledby="member-title">
        <h1 id="member-title">Member一覧</h1>
        <p>本人の支援に必要な最小情報を管理します。</p>
        <label htmlFor="unit">Unit</label>
        <select
          id="unit"
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            setCursor(null);
            setNextCursor(null);
            setPreviousCursors([]);
          }}
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
        {state === "ready" && members.length > 0 && (
          <nav aria-label="Member一覧のページ操作">
            <button
              type="button"
              disabled={previousCursors.length === 0}
              onClick={() => {
                const prior = previousCursors.at(-1) ?? null;
                setPreviousCursors((values) => values.slice(0, -1));
                setCursor(prior);
              }}
            >
              前へ
            </button>{" "}
            <button
              type="button"
              disabled={!nextCursor}
              onClick={() => {
                if (!nextCursor) return;
                setPreviousCursors((values) => [...values, cursor]);
                setCursor(nextCursor);
              }}
            >
              次へ
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}
