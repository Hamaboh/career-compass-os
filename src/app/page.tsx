import { verifyFoundation } from "./verify-action";

export default function Home() {
  return (
    <main id="main-content">
      <section className="panel" aria-labelledby="title">
        <h1 id="title">準備中</h1>
        <p>
          安全なアプリケーション基盤を構築しています。業務機能はまだ利用できません。
        </p>
        <form action={verifyFoundation}>
          <button type="submit">基盤を確認</button>
        </form>
      </section>
    </main>
  );
}
