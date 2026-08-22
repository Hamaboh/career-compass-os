import Link from "next/link";

export const metadata = { title: "アクセスできません | Career Compass OS" };
export default function AccessDeniedPage() {
  return (
    <main id="main-content">
      <section className="panel" aria-labelledby="access-denied-title">
        <h1 id="access-denied-title">このアプリを利用する権限がありません</h1>
        <p>利用登録または利用状態を管理者へ確認してください。</p>
        <Link href="/">トップへ戻る</Link>
      </section>
    </main>
  );
}
